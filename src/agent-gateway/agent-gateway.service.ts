import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { IncomingMessage } from 'http';
import { Duplex } from 'stream';
import { WebSocket, WebSocketServer, RawData } from 'ws';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  AgentHandshake,
  OutgoingScanRequest,
  requestChannel,
  resultChannel,
  ScanRequestPayload,
  ScanResultMessage,
  ScanResultPublishPayload,
} from './agent-gateway.types';

interface ScanContext {
  userId: string;
  orgId: string;
  officeId: string;
}

interface SocketSession {
  authenticated: boolean;
  orgId?: string;
  officeId?: string;
  officeAgentId?: string;
  requestHandler?: (msg: unknown) => void;
  authTimeout?: NodeJS.Timeout;
  isAlive: boolean;
}

const AUTH_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 20_000;
const MIN_IMAGE_BYTES = 1000;

@Injectable()
export class AgentGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentGatewayService.name);
  private wss!: WebSocketServer;
  private pingInterval?: NodeJS.Timeout;
  private readonly localSessions = new Map<string, Map<string, WebSocket>>();
  private readonly scanContext = new Map<string, ScanContext>();
  private readonly socketSessions = new Map<WebSocket, SocketSession>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly fileService: FileService,
  ) {}

  onModuleInit(): void {
    this.wss = new WebSocketServer({ noServer: true });

    this.pingInterval = setInterval(() => {
      for (const officeMap of this.localSessions.values()) {
        for (const ws of officeMap.values()) {
          const session = this.socketSessions.get(ws);
          if (!session) {
            continue;
          }

          if (!session.isAlive) {
            this.logger.warn('Terminating unresponsive agent socket');
            ws.terminate();
            continue;
          }

          session.isAlive = false;
          ws.ping();
        }
      }
    }, PING_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    await new Promise<void>((resolve) => {
      this.wss.close(() => resolve());
    });
  }

  handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.onConnection(ws, request);
    });
  }

  private onConnection(ws: WebSocket, _request: IncomingMessage): void {
    const session: SocketSession = {
      authenticated: false,
      isAlive: true,
    };
    this.socketSessions.set(ws, session);

    session.authTimeout = setTimeout(() => {
      if (!session.authenticated) {
        this.logger.warn('Agent auth timeout — closing socket');
        ws.close(1008, 'Authentication timeout');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (data) => {
      void this.handleMessage(ws, data);
    });

    ws.on('close', () => {
      void this.handleDisconnect(ws);
    });

    ws.on('error', (error) => {
      this.logger.error(
        `Agent WebSocket error: ${error instanceof Error ? error.message : String(error)}`,
      );
      void this.handleDisconnect(ws);
    });

    ws.on('pong', () => {
      session.isAlive = true;
    });
  }

  private async handleMessage(
    ws: WebSocket,
    data: RawData,
  ): Promise<void> {
    const session = this.socketSessions.get(ws);
    if (!session) {
      return;
    }

    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        this.logger.warn('Received non-JSON message from agent');
        ws.close(1008, 'Invalid message format');
        return;
      }

      if (!session.authenticated) {
        await this.handleAuth(ws, session, parsed as AgentHandshake);
        return;
      }

      const message = parsed as { type?: string };
      if (message.type === 'scan_result') {
        await this.handleScanResult(ws, session, parsed as ScanResultMessage);
        return;
      }

      this.logger.warn(
        `Unknown message type from agent: ${message.type ?? 'undefined'}`,
      );
    } catch (error) {
      this.logger.error(
        `Agent message handling failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async handleAuth(
    ws: WebSocket,
    session: SocketSession,
    handshake: AgentHandshake,
  ): Promise<void> {
    const { org_id, office_id, agent_secret } = handshake;
    if (!org_id || !office_id || !agent_secret) {
      this.logger.warn('Invalid agent handshake — missing fields');
      ws.close(1008, 'Invalid handshake');
      return;
    }

    const officeAgent = await this.prisma.officeAgent.findUnique({
      where: {
        organizationId_officeId: {
          organizationId: org_id,
          officeId: office_id,
        },
      },
    });

    if (!officeAgent) {
      this.logger.warn(
        `OfficeAgent not found for org=${org_id} office=${office_id}`,
      );
      ws.close(1008, 'Unauthorized');
      return;
    }

    const secretValid = await bcrypt.compare(
      agent_secret,
      officeAgent.agentSecretHash,
    );
    if (!secretValid) {
      this.logger.warn(
        `Invalid agent secret for org=${org_id} office=${office_id}`,
      );
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (session.authTimeout) {
      clearTimeout(session.authTimeout);
      session.authTimeout = undefined;
    }

    session.authenticated = true;
    session.orgId = org_id;
    session.officeId = office_id;
    session.officeAgentId = officeAgent.id;

    this.registerLocalSession(org_id, office_id, ws);

    await this.prisma.officeAgent.update({
      where: { id: officeAgent.id },
      data: { status: 'ONLINE', lastSeenAt: new Date() },
    });

    const requestHandler = (msg: unknown) => {
      const { scanId, userId } = msg as ScanRequestPayload;
      this.scanContext.set(scanId, {
        userId,
        orgId: org_id,
        officeId: office_id,
      });

      const outgoing: OutgoingScanRequest = { type: 'scan_request', scanId };
      ws.send(JSON.stringify(outgoing));
    };

    session.requestHandler = requestHandler;

    try {
      await this.redisService.subscribe(
        requestChannel(org_id, office_id),
        requestHandler,
      );
    } catch (error) {
      this.logger.error(
        `Redis subscribe failed for org=${org_id} office=${office_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      session.authenticated = false;
      session.orgId = undefined;
      session.officeId = undefined;
      session.officeAgentId = undefined;
      session.requestHandler = undefined;
      await this.prisma.officeAgent.update({
        where: { id: officeAgent.id },
        data: { status: 'OFFLINE' },
      });
      ws.close(1011, 'Fingerprint bridge unavailable');
      return;
    }

    this.logger.log(
      `Agent authenticated for org=${org_id} office=${office_id}`,
    );
  }

  private registerLocalSession(
    orgId: string,
    officeId: string,
    ws: WebSocket,
  ): void {
    let officeMap = this.localSessions.get(orgId);
    if (!officeMap) {
      officeMap = new Map<string, WebSocket>();
      this.localSessions.set(orgId, officeMap);
    }

    const existing = officeMap.get(officeId);
    if (existing && existing !== ws) {
      this.logger.warn(
        `Replacing stale agent socket for org=${orgId} office=${officeId}`,
      );
      existing.close(1000, 'Replaced by new connection');
    }

    officeMap.set(officeId, ws);
  }

  private async handleScanResult(
    ws: WebSocket,
    session: SocketSession,
    message: ScanResultMessage,
  ): Promise<void> {
    const { scanId, success } = message;
    const context = this.scanContext.get(scanId);
    const orgId = context?.orgId ?? session.orgId;
    const officeId = context?.officeId ?? session.officeId;
    const userId = context?.userId;

    if (!orgId || !officeId) {
      this.logger.warn(`scan_result missing org/office context for scanId=${scanId}`);
      return;
    }

    const s3Key = `fingerprints/${orgId}/${officeId}/${scanId}.png`;
    let publishPayload: ScanResultPublishPayload = {
      scanId,
      userId,
      success: false,
      error: message.error,
      code: message.code,
    };

    try {
      if (success && message.image) {
        let imageBase64 = message.image;
        if (imageBase64.startsWith('data:')) {
          imageBase64 = imageBase64.split(',')[1];
        }

        const buffer = Buffer.from(imageBase64, 'base64');
        if (buffer.length < MIN_IMAGE_BYTES) {
          throw new Error(
            `Image data too small or corrupted (${buffer.length} bytes)`,
          );
        }

        const uploadResult = await this.fileService.uploadBufferToS3(
          s3Key,
          buffer,
          'image/png',
        );

        if (userId) {
          await this.prisma.fingerprintScan.upsert({
            where: { id: scanId },
            update: {
              status: 'COMPLETED',
              s3Key: uploadResult.key,
              s3Url: uploadResult.url,
              quality: message.quality,
              fingerName: message.fingerName,
            },
            create: {
              id: scanId,
              organizationId: orgId,
              officeId,
              userId,
              s3Key: uploadResult.key,
              s3Url: uploadResult.url,
              quality: message.quality,
              fingerName: message.fingerName,
              status: 'COMPLETED',
            },
          });
        } else {
          this.logger.warn(
            `No userId in scan context for scanId=${scanId} — skipping DB write`,
          );
        }

        publishPayload = {
          scanId,
          s3Url: uploadResult.url,
          s3Key: uploadResult.key,
          userId,
          success: true,
        };
      } else {
        if (userId) {
          await this.prisma.fingerprintScan.upsert({
            where: { id: scanId },
            update: {
              status: 'FAILED',
              errorCode: message.code,
            },
            create: {
              id: scanId,
              organizationId: orgId,
              officeId,
              userId,
              s3Key,
              status: 'FAILED',
              errorCode: message.code,
            },
          });
        } else {
          this.logger.warn(
            `No userId in scan context for scanId=${scanId} — skipping DB write`,
          );
        }

        publishPayload = {
          scanId,
          userId,
          success: false,
          error: message.error,
          code: message.code,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process scan_result for scanId=${scanId}: ${errorMessage}`,
      );

      publishPayload = {
        scanId,
        userId,
        success: false,
        error: errorMessage,
        code: message.code ?? 'PROCESSING_ERROR',
      };
    }

    await this.redisService.publish(resultChannel(scanId), publishPayload);
    this.scanContext.delete(scanId);
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const session = this.socketSessions.get(ws);
    if (!session) {
      return;
    }

    if (session.authTimeout) {
      clearTimeout(session.authTimeout);
    }

    const { orgId, officeId, officeAgentId, requestHandler, authenticated } =
      session;

    if (authenticated && orgId && officeId && requestHandler) {
      await this.redisService.unsubscribe(
        requestChannel(orgId, officeId),
        requestHandler,
      );

      const officeMap = this.localSessions.get(orgId);
      if (officeMap) {
        if (officeMap.get(officeId) === ws) {
          officeMap.delete(officeId);
        }
        if (officeMap.size === 0) {
          this.localSessions.delete(orgId);
        }
      }
    }

    if (officeAgentId) {
      await this.prisma.officeAgent.update({
        where: { id: officeAgentId },
        data: { status: 'OFFLINE', lastSeenAt: new Date() },
      });
    }

    this.socketSessions.delete(ws);
  }
}
