import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Headers,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { BiometricService } from './biometric.service';
import { CaptureFingerprintDto, CaptureResponseDto } from './dto/capture-fingerprint.dto';
import { SaveFingerprintDto, SaveFingerprintResponseDto } from './dto/save-fingerprint.dto';

@ApiTags('Biometric')
@Controller('biometric')
export class BiometricController {
  constructor(private readonly biometric: BiometricService) {}

  // === USB Fingerprint Device Endpoints (via local agent) ===

  @Post('capture-fingerprint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capture fingerprint from local USB device',
    description:
      'Proxies request to local agent service. Agent location determined by X-Agent-Ip header or defaults to localhost:8765.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fingerprint captured successfully',
    type: CaptureResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters or capture failed',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Local agent service is not running or device not connected',
  })
  async captureFingerprint(
    @Body() dto: CaptureFingerprintDto,
    @Headers('x-agent-ip') agentIp?: string,
  ) {
    return await this.biometric.captureFingerprint(dto, agentIp);
  }

  @Post('save-fingerprint')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save captured fingerprint image to S3',
    description:
      'Uploads base64 fingerprint image to S3 bucket and returns the S3 key for storage in database.',
  })
  @ApiResponse({
    status: 201,
    description: 'Fingerprint saved to S3 successfully',
    type: SaveFingerprintResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid base64 image or missing required fields',
  })
  async saveFingerprint(@Body() dto: SaveFingerprintDto) {
    return await this.biometric.saveFingerprintToS3(dto);
  }

  @Get('agent-health')
  @ApiOperation({
    summary: 'Check local agent service health',
    description:
      'Returns health status of the fingerprint agent. Agent location determined by X-Agent-Ip header or defaults to localhost:8765. Also returns the client IP for auto-detection.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent health status retrieved',
  })
  async getAgentHealth(
    @Headers('x-agent-ip') agentIp?: string,
    @Headers('x-real-ip') realIp?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
    @Req() req?: any,
  ) {
    // Extract client IP for auto-detection on frontend
    // Priority: x-real-ip > cf-connecting-ip > x-forwarded-for > remoteAddress
    let clientIp = 'unknown';
    
    if (realIp) {
      clientIp = realIp.trim();
    } else if (cfIp) {
      clientIp = cfIp.trim();
    } else if (req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].split(',')[0]?.trim();
    } else if (req.connection?.remoteAddress) {
      clientIp = req.connection.remoteAddress;
    }
    
    const healthStatus = await this.biometric.checkAgentHealth(agentIp);
    
    // Add client IP to response for frontend auto-detection
    return {
      ...healthStatus,
      clientIp: clientIp,
    };
  }

  // === Networked Biometric Device Endpoints (ZKTeco) ===

  @Get('logs')
  getLogs() {
    return this.biometric.getLogs();
  }

  @Get('users')
  getUsers() {
    return this.biometric.getUsers();
  }

  @Get('time')
  getDeviceTime() {
    return this.biometric.getDeviceTime();
  }

  @Post('shutdown')
  shutdown() {
    return this.biometric.shutdown();
  }
}
