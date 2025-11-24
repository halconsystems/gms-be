import {
  Injectable,
  OnModuleInit,
  Logger,
  ServiceUnavailableException,
  BadRequestException,
  InternalServerErrorException,
  RequestTimeoutException,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FileService } from 'src/file/file.service';
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
   * To change port: Update appsettings.json (C#) or .env (Node.js) and restart agent.
   * API Contract: Same endpoints (/health, /api/fingerprint/capture, /api/fingerprint/verify, /api/fingerprint/device-status)
   * Response Format: Flat JSON with camelCase fields (success, image, template, quality, requestId, etc.)
   * Error Codes: DEVICE_NOT_CONNECTED, CAPTURE_TIMEOUT, INVALID_DEVICE_INDEX, POOR_QUALITY, CONCURRENT_CAPTURE, SDK_ERROR, etc.
   */
  private readonly AGENT_BASE_URL = 'http://localhost:8765';
  private readonly AGENT_TIMEOUT = 30000;
  private readonly AGENT_RETRY_ATTEMPTS = 3;
  private readonly AGENT_RETRY_DELAY = 1000;

  constructor(
    private readonly httpService: HttpService,
    private readonly fileService: FileService,
  ) {}

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
   */
  async captureFingerprint(dto: CaptureFingerprintDto) {
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
      `Proxying to agent at ${this.AGENT_BASE_URL}/fingerprint/capture with payload: ${JSON.stringify(normalizedDto)}`,
    );

    try {
      const response = await this.retryWithBackoff(
        async () => {
          const result = await firstValueFrom(
            this.httpService.post(
              `${this.AGENT_BASE_URL}/fingerprint/capture`,
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
   * Save captured fingerprint image to S3
   */
  async saveFingerprintToS3(dto: SaveFingerprintDto) {
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
   */
  async checkAgentHealth() {
    this.logger.debug('Checking agent health at ' + this.AGENT_BASE_URL + '/health');
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.AGENT_BASE_URL}/health`, {
          timeout: 5000,
        }),
      );

      this.logger.debug('Raw agent response status: ' + (response as any).status);
      this.logger.debug('Agent response data: ' + JSON.stringify((response as any).data));
      this.logger.debug('Agent device object: ' + JSON.stringify((response as any).data?.device));
      this.logger.debug('Agent isConnected value: ' + (response as any).data?.device?.isConnected);
      
      // Return the agent response directly - TransformInterceptor will wrap it with {status: 'success', message: '...', data: ...}
      // This avoids double-wrapping: service returns agent data directly, global interceptor adds the wrapper
      const agentResponse = (response as any).data;
      this.logger.debug('Returning agent response directly: ' + JSON.stringify(agentResponse));
      this.logger.debug('Agent device.isConnected: ' + agentResponse?.device?.isConnected);
      
      return agentResponse;
    } catch (error) {
      this.logger.error('Agent health check error details: ' + JSON.stringify({
        code: (error as any).code,
        message: (error as any).message,
        response: (error as any).response?.data
      }));
      
      if ((error as any).code === 'ECONNREFUSED') {
        this.logger.error('Agent is not running on localhost:8765 - ensure the agent service is started');
      }
      
      this.logger.warn('Returning unhealthy status due to agent error');
      // Return unhealthy status directly - TransformInterceptor will wrap it
      return {
        status: 'unhealthy',
        error: 'Agent not reachable',
      };
    }
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
