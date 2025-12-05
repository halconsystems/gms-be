import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveAgentConfigDto, AgentConfigResponseDto } from './dto/agent-config.dto';

@Injectable()
export class BiometricConfigService {
  private readonly logger = new Logger(BiometricConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Save or update fingerprint agent configuration for a user
   */
  async saveAgentConfig(dto: SaveAgentConfigDto): Promise<AgentConfigResponseDto> {
    this.logger.log(
      `Saving agent config for user ${dto.userId}: ${dto.agentIp}:${dto.agentPort || 8765}`,
    );

    // Validate that user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Validate IP format
    if (!this.isValidIp(dto.agentIp)) {
      throw new BadRequestException(
        `Invalid IP address format: ${dto.agentIp}. Use xxx.xxx.xxx.xxx format`,
      );
    }

    const port = dto.agentPort || 8765;

    // Upsert (update if exists, create if not)
    const config = await this.prisma.fingerprintAgentConfig.upsert({
      where: { userId: dto.userId },
      update: {
        agentIp: dto.agentIp,
        agentPort: port,
        updatedAt: new Date(),
      },
      create: {
        userId: dto.userId,
        agentIp: dto.agentIp,
        agentPort: port,
      },
    });

    this.logger.log(
      `Agent config saved successfully for user ${dto.userId}`,
    );

    return this.mapToResponseDto(config);
  }

  /**
   * Get agent configuration for a user
   */
  async getAgentConfig(userId: string): Promise<AgentConfigResponseDto | null> {
    this.logger.log(`Fetching agent config for user ${userId}`);

    // Validate that user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const config = await this.prisma.fingerprintAgentConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      this.logger.debug(`No agent config found for user ${userId}`);
      return null;
    }

    return this.mapToResponseDto(config);
  }

  /**
   * Delete agent configuration for a user
   */
  async deleteAgentConfig(userId: string): Promise<{ message: string; configId: string }> {
    this.logger.log(`Deleting agent config for user ${userId}`);

    // Validate that user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const config = await this.prisma.fingerprintAgentConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      throw new NotFoundException(
        `No agent config found for user ${userId}`,
      );
    }

    await this.prisma.fingerprintAgentConfig.delete({
      where: { userId },
    });

    this.logger.log(`Agent config deleted for user ${userId}`);

    return {
      message: `Agent configuration deleted for user ${userId}`,
      configId: config.id,
    };
  }

  /**
   * Get agent URL for a user
   * Returns the full URL: http://ip:port
   */
  async getAgentUrl(userId: string): Promise<string | null> {
    const config = await this.getAgentConfig(userId);
    if (!config) {
      return null;
    }
    return `http://${config.agentIp}:${config.agentPort}`;
  }

  /**
   * Validate IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Map database record to response DTO
   */
  private mapToResponseDto(config: any): AgentConfigResponseDto {
    return {
      id: config.id,
      userId: config.userId,
      agentIp: config.agentIp,
      agentPort: config.agentPort,
      configuredAt: config.configuredAt,
      updatedAt: config.updatedAt,
      isActive: config.isActive,
      agentUrl: `http://${config.agentIp}:${config.agentPort}`,
    };
  }
}
