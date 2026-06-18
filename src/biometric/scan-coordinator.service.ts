import {
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  requestChannel,
  resultChannel,
  ScanResultPublishPayload,
} from '../agent-gateway/agent-gateway.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const SCAN_TIMEOUT_MS = 55_000;

interface PendingScan {
  timer: NodeJS.Timeout;
  handler: (msg: unknown) => void;
  channel: string;
}

@Injectable()
export class ScanCoordinatorService {
  private readonly logger = new Logger(ScanCoordinatorService.name);
  private readonly pending = new Map<string, PendingScan>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  triggerScan(
    orgId: string,
    officeId: string,
    userId: string,
    fingerName?: string,
  ): Promise<ScanResultPublishPayload> {
    const scanId = randomUUID();
    const s3Key = `fingerprints/${orgId}/${officeId}/${scanId}.png`;

    return new Promise<ScanResultPublishPayload>((resolve, reject) => {
      void (async () => {
        try {
          await this.prisma.fingerprintScan.create({
            data: {
              id: scanId,
              organizationId: orgId,
              officeId,
              userId,
              s3Key,
              fingerName,
              status: 'PENDING',
            },
          });
        } catch (error) {
          reject(error);
          return;
        }

        const channel = resultChannel(scanId);

        const handler = (msg: unknown) => {
          const payload = msg as ScanResultPublishPayload;
          if (payload.scanId !== scanId) {
            return;
          }

          void this.cleanupPending(scanId);

          if (payload.success) {
            resolve(payload);
            return;
          }

          reject(this.toScanError(payload));
        };

        const timer = setTimeout(() => {
          void this.cleanupPending(scanId);
          reject(
            new GatewayTimeoutException(
              'Fingerprint scan timed out waiting for agent response',
            ),
          );
        }, SCAN_TIMEOUT_MS);

        this.pending.set(scanId, { timer, handler, channel });

        try {
          await this.redisService.subscribe(channel, handler);
          await this.redisService.publish(requestChannel(orgId, officeId), {
            scanId,
            userId,
          });
        } catch (error) {
          await this.cleanupPending(scanId);
          reject(error);
        }
      })();
    });
  }

  private async cleanupPending(scanId: string): Promise<void> {
    const entry = this.pending.get(scanId);
    if (!entry) {
      return;
    }

    clearTimeout(entry.timer);
    this.pending.delete(scanId);

    try {
      await this.redisService.unsubscribe(entry.channel, entry.handler);
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe from ${entry.channel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toScanError(payload: ScanResultPublishPayload): HttpException {
    const message = payload.error ?? 'Fingerprint scan failed';
    const code = payload.code;

    switch (code) {
      case 'CONCURRENT_CAPTURE':
        return new ConflictException({ message, code });
      case 'CAPTURE_TIMEOUT':
        return new GatewayTimeoutException(message);
      case 'PROCESSING_ERROR':
        return new ServiceUnavailableException({ message, code });
      default:
        return new BadRequestException({ message, code });
    }
  }
}
