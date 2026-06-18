import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { BiometricService } from './biometric.service';
import { BiometricConfigService } from './biometric-config.service';
import { CaptureFingerprintDto, CaptureResponseDto } from './dto/capture-fingerprint.dto';
import { SaveFingerprintDto, SaveFingerprintResponseDto } from './dto/save-fingerprint.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SaveAgentConfigDto, AgentConfigResponseDto, AgentConfigDeleteResponseDto } from './dto/agent-config.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';

@ApiTags('Biometric')
@Controller('biometric')
export class BiometricController {
  constructor(
    private readonly biometric: BiometricService,
    private readonly configService: BiometricConfigService,
  ) {}

  // === USB Fingerprint Device Endpoints (via local agent) ===

  @Post('capture-fingerprint')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capture fingerprint from local USB device',
    description:
      'Proxies request to local agent service. Agent IP is determined from office configuration stored in database.',
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
    @Req() req: any,
    @Headers('x-agent-ip') xAgentIp?: string,
  ) {
    let agentIp: string | undefined;
    let agentPort: number | undefined;

    // 1. X-Agent-Ip header (explicit agent IP from request)
    // 2. User-config lookup from database (IP and port)
    // 3. FINGERPRINT_AGENT_URL env var or localhost:9001
    if (xAgentIp) {
      agentIp = xAgentIp.trim();
    } else {
      const userId = req.user?.id;
      if (userId) {
        const agentConfig = await this.configService.getAgentConfig(userId);
        agentIp = agentConfig?.agentIp;
        agentPort = agentConfig?.agentPort;
      }
    }

    return await this.biometric.captureFingerprint(dto, agentIp, agentPort);
  }

  @Post('save-fingerprint')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('jwt')
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
  async saveFingerprint(
    @Body() dto: SaveFingerprintDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return await this.biometric.saveFingerprintToS3(dto, organizationId);
  }

  @Get('agent-health')
  @ApiOperation({
    summary: 'Check local agent service health',
    description:
      'Returns health status of the fingerprint agent. Agent IP is determined from user configuration stored in database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent health status retrieved',
  })
  async getAgentHealth(
    @Req() req: any,
    @Headers('x-real-ip') realIp?: string,
    @Headers('cf-connecting-ip') cfIp?: string,
  ) {
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

    const userId = req.user?.id;
    let agentIp: string | undefined;

    if (userId) {
      const agentConfig = await this.configService.getAgentConfig(userId);
      agentIp = agentConfig?.agentIp;
    }

    const healthStatus = await this.biometric.checkAgentHealth(agentIp);

    return {
      ...healthStatus,
      clientIp,
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

  // === Agent Configuration Endpoints ===

  @Post('agent-config')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save or update fingerprint agent configuration for a user',
    description:
      'Stores the IP address and port of the fingerprint agent for a specific user. Each user can have their own agent configuration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Agent configuration saved successfully',
    type: AgentConfigResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid IP format or missing required fields',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async saveAgentConfig(@Body() dto: SaveAgentConfigDto) {
    return await this.configService.saveAgentConfig(dto);
  }

  @Get('agent-config/:userId')
  @ApiOperation({
    summary: 'Get fingerprint agent configuration for a user',
    description: 'Retrieves the stored agent IP and port configuration for a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent configuration retrieved successfully',
    type: AgentConfigResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found or no configuration exists',
  })
  async getAgentConfig(@Param('userId') userId: string) {
    const config = await this.configService.getAgentConfig(userId);
    return config || { message: 'No agent configuration found for this user' };
  }

  @Put('agent-config/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update fingerprint agent configuration for a user',
    description: 'Updates the agent IP and/or port for a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent configuration updated successfully',
    type: AgentConfigResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid IP format',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
  })
  async updateAgentConfig(
    @Param('userId') userId: string,
    @Body() dto: SaveAgentConfigDto,
  ) {
    return await this.configService.saveAgentConfig({
      ...dto,
      userId,
    });
  }

  @Delete('agent-config/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete fingerprint agent configuration for a user',
    description: 'Removes the stored agent configuration for a specific user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Agent configuration deleted successfully',
    type: AgentConfigDeleteResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found or configuration does not exist',
  })
  async deleteAgentConfig(@Param('userId') userId: string) {
    return await this.configService.deleteAgentConfig(userId);
  }
}
