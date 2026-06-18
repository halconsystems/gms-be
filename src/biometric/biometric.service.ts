import {
  Injectable,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
  InternalServerErrorException,
  RequestTimeoutException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { FileService } from 'src/file/file.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaptureFingerprintDto } from './dto/capture-fingerprint.dto';
import { SaveFingerprintDto } from './dto/save-fingerprint.dto';
import { firstValueFrom } from 'rxjs';
const ZKTeco = require('zkteco');

@Injectable()
export class BiometricService {
  private readonly logger = new Logger(BiometricService.name);
  private zkInstance: any;
  private readonly deviceIp = '192.168.1.201';
  private readonly devicePort = '4370';

  /**
   * Agent base URL for fingerprint operations.
   * Compatible with both Node.js agent (gms-fingerprint-agent) and C# agent (gms-fingerprint-agent-cs).
   * Both agents listen on port 8765 by default.
   * 
   * Configuration via environment variable:
   * - FINGERPRINT_AGENT_URL: Full URL to agent (e.g., http://192.168.1.100:8765)
   * - Defaults to http://localhost:8765 if not set
   * 
   * Important: If backend is on a different machine than agent, use the agent's actual IP/hostname
   * Example: export FINGERPRINT_AGENT_URL=http://192.168.1.50:8765
   * 
   * API Contract: Same endpoints (/health, /api/fingerprint/capture, /api/fingerprint/verify, /api/fingerprint/device-status)
   * Response Format: Flat JSON with camelCase fields (success, image, template, quality, requestId, etc.)
   * Error Codes: DEVICE_NOT_CONNECTED, CAPTURE_TIMEOUT, INVALID_DEVICE_INDEX, POOR_QUALITY, CONCURRENT_CAPTURE, SDK_ERROR, etc.
   */
  private readonly AGENT_BASE_URL: string;
  private readonly AGENT_TIMEOUT = 30000;
  private readonly AGENT_RETRY_ATTEMPTS = 3;
  private readonly AGENT_RETRY_DELAY = 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly fileService: FileService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Read agent URL from environment variable, default to localhost
    this.AGENT_BASE_URL = this.configService.get<string>(
      'FINGERPRINT_AGENT_URL',
      'http://localhost:8765',
    );
    this.logger.log(
      `[INIT] Fingerprint agent configured at: ${this.AGENT_BASE_URL}`,
    );
  }

  async onModuleInit() {
    const devices = [{ deviceIp: this.deviceIp, devicePort: this.devicePort }];
    this.zkInstance = new ZKTeco(devices);

    try {
      await this.zkInstance.connectAll();
      this.logger.log('Connected to ZKTeco biometric device.');
    } catch (err) {
      this.logger.error('Failed to connect to device:', err.message);
    }
  }

  /**
   * Capture fingerprint from local USB device via agent
   * 
   * Agent IP Resolution:
   * 1. Use agentIp and agentPort parameters from database lookup (FingerprintAgentConfig)
   * 2. If not provided, use FINGERPRINT_AGENT_URL environment variable
   * 3. If not set, fallback to http://localhost:9001
   */
  async captureFingerprint(dto: CaptureFingerprintDto, agentIp?: string, agentPort?: number) {
    // Build agent URL from provided IP and port or use default
    const agentUrl = this.buildAgentUrl(agentIp, agentPort);
    
    // Log agent IP source for debugging
    if (agentIp) {
      this.logger.log(`[AGENT IP SOURCE] From database/config: ${agentIp}:${agentPort || 9001}`);
    } else {
      this.logger.log(`[AGENT IP SOURCE] Using default: ${this.AGENT_BASE_URL}`);
    }
    
    // Debug log to inspect raw DTO values from global pipe
    this.logger.debug('Raw DTO before normalization: ' + JSON.stringify(dto));

    // Ensure numeric values are actually numbers before sending to agent
    // This handles cases where values might be strings from query params or body
    const normalizedDto = {
      deviceIndex: dto.deviceIndex != null ? Number(dto.deviceIndex) : 0,
      maxRetries: dto.maxRetries != null ? Number(dto.maxRetries) : this.AGENT_RETRY_ATTEMPTS,
      timeout: dto.timeout != null ? Number(dto.timeout) : this.AGENT_TIMEOUT,
    };

    // Derive effective timeout and retry attempts from normalized DTO, falling back to defaults
    const effectiveTimeout = normalizedDto.timeout ?? this.AGENT_TIMEOUT;
    const effectiveRetries = normalizedDto.maxRetries ?? this.AGENT_RETRY_ATTEMPTS;

    this.logger.log(
      `Capturing fingerprint with config: ${JSON.stringify(normalizedDto)} (effective timeout: ${effectiveTimeout}ms, retries: ${effectiveRetries})`,
    );

    this.logger.debug(
      `Proxying to agent at ${agentUrl}/fingerprint/capture with payload: ${JSON.stringify(normalizedDto)}`,
    );

    try {
      const response = await this.retryWithBackoff(
        async () => {
          const result = await firstValueFrom(
            this.httpService.post(
              `${agentUrl}/fingerprint/capture`,
              normalizedDto,
              { timeout: effectiveTimeout },
            ),
          );
          return (result as any).data;
        },
        effectiveRetries,
        this.AGENT_RETRY_DELAY,
      );

      this.logger.log('Fingerprint captured successfully');
      // Return agent response directly (already flat: {success, image, quality, ...})
      return response;
    } catch (error) {
      // Simplified logging for flat error format
      const status = error?.response?.status;
      const data = error?.response?.data;
      
      this.logger.error(`Agent response status: ${status}`);
      
      try {
        this.logger.error(`Agent response data: ${JSON.stringify(data)}`);
      } catch {
        this.logger.error(`Could not stringify agent data`);
      }
      
      // Log flat error string (agent now returns flat {error: "message"} format)
      const errorMessage = data?.error || (error as any)?.message || 'Unknown error';
      this.logger.error(`Capture error: ${errorMessage}`);
      
      this.handleCaptureError(error);
    }
  }

  /**
   * Ensure personId belongs to the authenticated user's organization.
   */
  async assertPersonInOrganization(
    personId: string,
    organizationId: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: personId, organizationId },
      select: { id: true },
    });

    if (employee) {
      return;
    }

    const guard = await this.prisma.guard.findFirst({
      where: { id: personId, organizationId },
      select: { id: true },
    });

    if (guard) {
      return;
    }

    throw new NotFoundException(
      'Person not found in your organization',
    );
  }

  /**
   * Save captured fingerprint image to S3
   */
  async saveFingerprintToS3(dto: SaveFingerprintDto, organizationId: string) {
    if (!dto.personId) {
      throw new BadRequestException('personId is required');
    }

    await this.assertPersonInOrganization(dto.personId, organizationId);

    this.logger.log(`Saving fingerprint to S3: ${dto.fingerName}`);

    let imageBuffer: Buffer | null = null;

    try {
      // Validate and convert base64 image
      if (!dto.image) {
        throw new BadRequestException('Image data is required');
      }

      // Remove data URI prefix if present
      let imageBase64 = dto.image;
      if (dto.image.startsWith('data:')) {
        imageBase64 = dto.image.split(',')[1];
      }

      imageBuffer = Buffer.from(imageBase64, 'base64');

      // Validate minimum image size (fingerprint PNGs are typically 15-30KB)
      if (imageBuffer.length < 1000) {
        this.logger.error(`Image buffer too small: ${imageBuffer.length} bytes`);
        throw new BadRequestException('Image data is too small or corrupted. Please recapture.');
      }
      this.logger.debug(`Image buffer size: ${imageBuffer.length} bytes`);

      // Generate unique S3 key
      const s3Key = `fingerprints/${dto.personId || 'unknown'}/${dto.fingerName}-${Date.now()}.png`;

      this.logger.debug(`Uploading to S3 with key: ${s3Key}`);

      // Upload to S3 using FileService method
      const result = await this.fileService.uploadBufferToS3(s3Key, imageBuffer, 'image/png');

      this.logger.debug(`S3 upload result: ${JSON.stringify(result)}`);
      this.logger.log(`Fingerprint uploaded to S3: ${s3Key} (URL: ${result.url})`);

      return {
        success: true,
        s3Key: result.key,
        url: result.url,
        template: dto.template,
      };
    } catch (error) {
      // If error is already an HttpException (e.g., BadRequestException), rethrow it
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to save fingerprint to S3: ${error.message}`, {
        s3Key: `fingerprints/${dto.personId || 'unknown'}/${dto.fingerName}-${Date.now()}.png`,
        fingerName: dto.fingerName,
        imageSize: imageBuffer ? imageBuffer.length : 0,
        errorStack: error.stack,
      });
      throw new InternalServerErrorException(
        'Failed to save fingerprint. Please try again.',
      );
    }
  }

  /**
   * Check health status of local agent
   * Transforms agent's complex response to frontend's expected format
   * 
   * Important: Agent returns HTTP 200 when healthy, HTTP 503 when degraded/unhealthy
   * We must accept both responses as valid (not treat 503 as error)
   * 
   * Agent IP Resolution:
   * 1. Use agentIp parameter from database lookup (FingerprintAgentConfig)
   * 2. If not provided, use FINGERPRINT_AGENT_URL environment variable
   * 3. If not set, fallback to http://localhost:8765
   * 
   * @param agentIp Optional agent IP address fetched from database (e.g., 192.168.1.50)
   *                If not provided, uses default from config
   */
  async checkAgentHealth(agentIp?: string, agentPort?: number) {
    // Build agent URL from provided IP and port or use default
    const agentUrl = this.buildAgentUrl(agentIp, agentPort);
    
    // Log agent IP source for debugging
    if (agentIp) {
      this.logger.log(`[AGENT IP SOURCE] From database/config: ${agentIp}`);
    } else {
      this.logger.log(`[AGENT IP SOURCE] Using default: ${this.AGENT_BASE_URL}`);
    }
    
    this.logger.log('');
    this.logger.log('█'.repeat(60));
    this.logger.log('█ HEALTH CHECK START');
    this.logger.log('█ Target URL: ' + agentUrl + '/health');
    this.logger.log('█ Agent IP provided: ' + (agentIp ? 'yes' : 'no'));
    this.logger.log('█ Timeout: 5000ms');
    this.logger.log('█ Timestamp: ' + new Date().toISOString());
    this.logger.log('█'.repeat(60));
    
    try {
      this.logger.log('> Making HTTP GET request...');
      
      // Use validateStatus to accept both 200 and 503 responses from agent
      // Agent returns:
      // - 200 + {status: 'healthy', device: {isConnected: true, ...}} when healthy
      // - 503 + {status: 'degraded', device: {isConnected: false, ...}} when degraded
      const httpConfig = {
        timeout: 5000,
        validateStatus: (status: number) => status === 200 || status === 503,
      };
      
      this.logger.log('HTTP Config: ' + JSON.stringify(httpConfig));
      
      const response = await firstValueFrom(
        this.httpService.get(`${agentUrl}/health`, httpConfig),
      );

      this.logger.log('✓✓✓ RESPONSE RECEIVED ✓✓✓');
      
      const agentResponse = (response as any).data;
      const httpStatus = (response as any).status;
      const headers = (response as any).headers;
      
      this.logger.log('HTTP Status Code: ' + httpStatus);
      this.logger.log('Response Headers: ' + JSON.stringify(headers, null, 2));
      this.logger.log('Response Content-Type: ' + headers?.['content-type']);
      this.logger.log('Response Body Type: ' + typeof agentResponse);
      this.logger.log('Response Body Constructor: ' + agentResponse?.constructor?.name);
      
      if (typeof agentResponse === 'object' && agentResponse !== null) {
        this.logger.log('Response Keys: ' + Object.keys(agentResponse).join(', '));
      }
      
      this.logger.log('Full Response Body: ');
      this.logger.log(JSON.stringify(agentResponse, null, 2));
      
      // Extract device info with detailed logging
      this.logger.log('');
      this.logger.log('EXTRACTING DEVICE INFO:');
      this.logger.log('  agentResponse.status: ' + agentResponse?.status + ' (type: ' + typeof agentResponse?.status + ')');
      this.logger.log('  agentResponse.device: ' + JSON.stringify(agentResponse?.device));
      this.logger.log('  agentResponse.device?.isConnected: ' + agentResponse?.device?.isConnected + ' (type: ' + typeof agentResponse?.device?.isConnected + ')');
      this.logger.log('  agentResponse.device?.count: ' + agentResponse?.device?.count + ' (type: ' + typeof agentResponse?.device?.count + ')');
      
      // Transform agent's comprehensive response to frontend's expected format
      // Agent returns: {status, agent, sdk, device: {isConnected, count, ...}, memory, diagnostics, ...}
      // Frontend expects: {status, device: {isConnected}}
      const transformedResponse = {
        status: agentResponse?.status || 'unhealthy',
        device: {
          isConnected: agentResponse?.device?.isConnected ?? false,
          // Include count if available
          ...(agentResponse?.device?.count !== undefined && { count: agentResponse.device.count }),
        },
      };
      
      this.logger.log('');
      this.logger.log('TRANSFORMED RESPONSE:');
      this.logger.log(JSON.stringify(transformedResponse, null, 2));
      this.logger.log('');
      this.logger.log('█ HEALTH CHECK SUCCESS');
      this.logger.log('█'.repeat(60));
      this.logger.log('');
      
      // Return transformed data - TransformInterceptor will wrap it with {status: 'success', message: '...', data: ...}
      return transformedResponse;
    } catch (error) {
      this.logger.log('');
      this.logger.log('█'.repeat(60));
      this.logger.log('█ HEALTH CHECK ERROR');
      this.logger.log('█'.repeat(60));
      this.logger.error('Error type: ' + error?.constructor?.name);
      this.logger.error('Error code: ' + (error as any).code);
      this.logger.error('Error message: ' + (error as any).message);
      this.logger.error('Error stack (first 500 chars): ' + String((error as any).stack).substring(0, 500));
      
      const axiosError = error as any;
      if (axiosError.response) {
        this.logger.error('Has response object: YES');
        this.logger.error('  response.status: ' + axiosError.response?.status);
        this.logger.error('  response.statusText: ' + axiosError.response?.statusText);
        this.logger.error('  response.headers: ' + JSON.stringify(axiosError.response?.headers));
        this.logger.error('  response.data: ' + JSON.stringify(axiosError.response?.data));
      } else {
        this.logger.error('Has response object: NO (network error)');
      }
      
      this.logger.error('Error details: ' + JSON.stringify({
        code: (error as any).code,
        message: (error as any).message,
        errno: (error as any).errno,
        syscall: (error as any).syscall,
        hostname: (error as any).hostname,
        port: (error as any).port,
      }));
      
      if ((error as any).code === 'ECONNREFUSED') {
        this.logger.error('⚠⚠⚠ CONNECTION REFUSED ⚠⚠⚠');
        this.logger.error('Agent is not running on ' + agentUrl);
        this.logger.error('Hostname: ' + (error as any).hostname);
        this.logger.error('Port: ' + (error as any).port);
      }
      
      if ((error as any).code === 'ETIMEDOUT') {
        this.logger.error('⚠⚠⚠ CONNECTION TIMEOUT ⚠⚠⚠');
        this.logger.error('Socket timed out - agent took longer than 5000ms to respond');
      }
      
      if ((error as any).code === 'ECONNABORTED') {
        this.logger.error('⚠⚠⚠ REQUEST ABORTED ⚠⚠⚠');
        this.logger.error('Request was aborted - agent not responding');
      }
      
      this.logger.log('');
      this.logger.log('█ Returning unhealthy status due to error');
      this.logger.log('█'.repeat(60));
      this.logger.log('');
      
      // Return unhealthy status in frontend's expected format
      return {
        status: 'unhealthy',
        device: {
          isConnected: false,
        },
        error: 'Agent not reachable',
      };
    }
  }

  /**
   * Build agent URL from provided IP or use default
   * @param agentIp Optional IP address (e.g., 192.168.1.50)
   * @returns Full agent URL (e.g., http://192.168.1.50:8765)
   */
  private buildAgentUrl(agentIp?: string, agentPort?: number): string {
    if (agentIp && agentIp.trim()) {
      // User provided IP - build URL from it
      const cleanIp = agentIp.trim();
      // If IP doesn't have protocol, add it
      if (cleanIp.startsWith('http://') || cleanIp.startsWith('https://')) {
        return cleanIp;
      }
      // Use provided port or default to 9001 (configured in appsettings.json)
      const port = agentPort || 9001;
      return `http://${cleanIp}:${port}`;
    }
    // Use default from config or environment variable
    return this.AGENT_BASE_URL;
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    attempts: number,
    baseDelay: number,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Only retry on network errors, not on 4xx responses
        // Include ECONNABORTED (timeout), ECONNRESET (transient), ECONNREFUSED, ETIMEDOUT, ENOTFOUND
        const isNetworkError =
          (error as any).code === 'ECONNREFUSED' ||
          (error as any).code === 'ETIMEDOUT' ||
          (error as any).code === 'ECONNABORTED' ||
          (error as any).code === 'ECONNRESET' ||
          (error as any).code === 'ENOTFOUND';

        if (!isNetworkError || attempt === attempts) {
          throw error;
        }

        // Exponential backoff: delay * (2 ^ (attempt - 1))
        const delay = baseDelay * Math.pow(2, attempt - 1);
        this.logger.debug(
          `Retry attempt ${attempt}/${attempts} after ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Handle capture errors and throw appropriate exceptions
   * Preserves agent error codes in response body for frontend-side error message mapping
   */
  private handleCaptureError(error: any): never {
    // Network errors: Agent service unreachable
    if (error.code === 'ECONNREFUSED') {
      this.logger.error(
        `Connection refused: code=${error.code}, message=${error.message}`,
      );
      const responseBody = {
        statusCode: 503,
        message: 'Local fingerprint agent is not running. Please ensure the agent service is started on localhost:8765.',
        code: 'AGENT_UNAVAILABLE',
      };
      throw new HttpException(responseBody, 503);
    }

    // Network timeout errors
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ENOTFOUND'
    ) {
      this.logger.error(
        `Timeout error: code=${error.code}, message=${error.message}`,
      );
      const responseBody = {
        statusCode: 408,
        message: 'Fingerprint capture timed out. Please try again.',
        code: 'NETWORK_TIMEOUT',
      };
      throw new HttpException(responseBody, 408);
    }

    // Agent HTTP 400: Device errors or capture failures
    if (error.response?.status === 400) {
      // Agent response format (flat): { success: false, error: string, code: string, requestId: '...' }
      const agentResponseData = error.response.data;
      
      let errorMessage = 'Device not connected or capture failed';
      let agentCode = 'CAPTURE_FAILED';

      const agentError = agentResponseData?.error;
      const agentCodeField = agentResponseData?.code;

      if (typeof agentError === 'string') {
        errorMessage = agentError;
      } else if (agentError?.message) {
        // Fallback for old nested format during transition
        errorMessage = String(agentError.message);
      }

      if (typeof agentCodeField === 'string') {
        agentCode = agentCodeField;
      }

      this.logger.error(`Agent returned 400 error [${agentCode}]: ${errorMessage}`);
      
      const responseBody = {
        statusCode: 400,
        message: errorMessage,
        code: agentCode,
        technicalMessage: errorMessage,
      };
      throw new HttpException(responseBody, 400);
    }

    // Agent HTTP 408: Request timeout (e.g., capture timeout)
    if (error.response?.status === 408) {
      // Agent returns 408 for timeout (flat format)
      const agentResponseData = error.response.data;
      
      let errorMessage = 'Fingerprint capture timed out. Please try again.';
      let agentCode = 'CAPTURE_TIMEOUT';

      const agentError = agentResponseData?.error;
      const agentCodeField = agentResponseData?.code;

      if (typeof agentError === 'string') {
        errorMessage = agentError;
      } else if (agentError?.message) {
        // Fallback for old nested format during transition
        errorMessage = String(agentError.message);
      }

      if (typeof agentCodeField === 'string') {
        agentCode = agentCodeField;
      }

      this.logger.error(`Agent returned 408 error [${agentCode}]: ${errorMessage}`);
      
      const responseBody = {
        statusCode: 408,
        message: errorMessage,
        code: agentCode,
        technicalMessage: errorMessage,
      };
      throw new HttpException(responseBody, 408);
    }

    // Agent HTTP 503: Service unavailable or device not ready
    if (error.response?.status === 503) {
      // Agent response format (flat): { success: false, error: string, code: string, requestId: '...' }
      const agentResponseData = error.response.data;
      
      let errorMessage = 'Fingerprint device not available or agent in degraded mode';
      let agentCode = 'SERVICE_UNAVAILABLE';

      const agentError = agentResponseData?.error;
      const agentCodeField = agentResponseData?.code;

      if (typeof agentError === 'string') {
        errorMessage = agentError;
      } else if (agentError?.message) {
        // Fallback for old nested format during transition
        errorMessage = String(agentError.message);
      }

      if (typeof agentCodeField === 'string') {
        agentCode = agentCodeField;
      }

      this.logger.error(`Agent returned 503 error [${agentCode}]: ${errorMessage}`);
      
      const responseBody = {
        statusCode: 503,
        message: errorMessage,
        code: agentCode,
        technicalMessage: errorMessage,
      };
      throw new HttpException(responseBody, 503);
    }

    // Generic fallback error for unhandled cases
    this.logger.error(
      `Capture error: message=${(error as any)?.message}, code=${(error as any)?.code}`,
    );
    
    // Attempt to extract agent code from response, fallback to generic
    const agentCode = error.response?.data?.code || 'CAPTURE_FAILED';
    const agentMessage = error.response?.data?.error || error.response?.data?.message || error.message || 'Unknown error';

    this.logger.error(`Unhandled error [${agentCode}]: ${agentMessage}`);

    const responseBody = {
      statusCode: 500,
      message: 'Fingerprint capture failed. Please try again.',
      code: agentCode,
      technicalMessage: agentMessage,
    };
    throw new HttpException(responseBody, 500);
  }

  private generateRequestId(): string {
    return `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // === Existing networked device methods ===

  async getLogs() {
    return await this.zkInstance.getAttendances(this.deviceIp);
  }

  async getUsers() {
    return await this.zkInstance.getUsers(this.deviceIp);
  }

  async getDeviceTime() {
    return await this.zkInstance.getTime(this.deviceIp);
  }

  async shutdown() {
    return await this.zkInstance.shutdown(this.deviceIp);
  }
}
