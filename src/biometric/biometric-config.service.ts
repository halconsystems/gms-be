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
   * Save or update fingerprint agent configuration for an office
   */
  async saveAgentConfig(dto: SaveAgentConfigDto): Promise<AgentConfigResponseDto> {
    this.logger.log(
      `Saving agent config for office ${dto.officeId}: ${dto.agentIp}:${dto.agentPort || 8765}`,
    );

    // Validate that office exists
    const office = await this.prisma.office.findUnique({
      where: { id: dto.officeId },
    });

    if (!office) {
      throw new NotFoundException(`Office with ID ${dto.officeId} not found`);
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
      where: { officeId: dto.officeId },
      update: {
        agentIp: dto.agentIp,
        agentPort: port,
        updatedAt: new Date(),
      },
      create: {
        officeId: dto.officeId,
        agentIp: dto.agentIp,
        agentPort: port,
      },
    });

    this.logger.log(
      `Agent config saved successfully for office ${dto.officeId}`,
    );

    return this.mapToResponseDto(config);
  }

  /**
   * Get agent configuration for an office
   */
  async getAgentConfig(officeId: string): Promise<AgentConfigResponseDto | null> {
    this.logger.log(`Fetching agent config for office ${officeId}`);

    // Validate that office exists
    const office = await this.prisma.office.findUnique({
      where: { id: officeId },
    });

    if (!office) {
      throw new NotFoundException(`Office with ID ${officeId} not found`);
    }

    const config = await this.prisma.fingerprintAgentConfig.findUnique({
      where: { officeId },
    });

    if (!config) {
      this.logger.debug(`No agent config found for office ${officeId}`);
      return null;
    }

    return this.mapToResponseDto(config);
  }

  /**
   * Delete agent configuration for an office
   */
  async deleteAgentConfig(officeId: string): Promise<{ message: string; configId: string }> {
    this.logger.log(`Deleting agent config for office ${officeId}`);

    // Validate that office exists
    const office = await this.prisma.office.findUnique({
      where: { id: officeId },
    });

    if (!office) {
      throw new NotFoundException(`Office with ID ${officeId} not found`);
    }

    const config = await this.prisma.fingerprintAgentConfig.findUnique({
      where: { officeId },
    });

    if (!config) {
      throw new NotFoundException(
        `No agent config found for office ${officeId}`,
      );
    }

    await this.prisma.fingerprintAgentConfig.delete({
      where: { officeId },
    });

    this.logger.log(`Agent config deleted for office ${officeId}`);

    return {
      message: `Agent configuration deleted for office ${officeId}`,
      configId: config.id,
    };
  }

  /**
   * Get agent URL for an office
   * Returns the full URL: http://ip:port
   */
  async getAgentUrl(officeId: string): Promise<string | null> {
    const config = await this.getAgentConfig(officeId);
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
      officeId: config.officeId,
      agentIp: config.agentIp,
      agentPort: config.agentPort,
      configuredAt: config.configuredAt,
      updatedAt: config.updatedAt,
      isActive: config.isActive,
      agentUrl: `http://${config.agentIp}:${config.agentPort}`,
    };
  }
}
