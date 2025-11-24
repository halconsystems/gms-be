import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
      'Proxies request to local agent service running on localhost:8765. Requires agent to be running.',
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
  async captureFingerprint(@Body() dto: CaptureFingerprintDto) {
    return await this.biometric.captureFingerprint(dto);
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
      'Returns health status of the local fingerprint agent service and connected devices.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent health status retrieved',
  })
  async getAgentHealth() {
    return await this.biometric.checkAgentHealth();
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
