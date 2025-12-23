import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterAgentDto, RegisterAgentResponseDto } from './dto/register-agent.dto';
import { HeartbeatResponseDto } from './dto/heartbeat.dto';
import { AgentStatusDto } from './dto/agent-status.dto';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates IP address format
   */
  private isValidIp(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Register agent on startup or update existing agent registration
   */
  async registerAgent(
    dto: RegisterAgentDto,
  ): Promise<RegisterAgentResponseDto> {
    const { userId, agentIp, agentPort = 3001 } = dto;

    try {
      // Validate user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Validate IP format
      if (!this.isValidIp(agentIp)) {
        throw new BadRequestException(`Invalid IP address format: ${agentIp}`);
      }

      // Upsert agent registration (create or update)
      const registration = await this.prisma.agentRegistration.upsert({
        where: { userId },
        update: {
          agentIp,
          agentPort,
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        },
        create: {
          userId,
          agentIp,
          agentPort,
          status: 'ONLINE',
          lastHeartbeat: new Date(),
        },
      });

      this.logger.log(
        `Agent registered for user ${userId}: ${agentIp}:${agentPort}`,
      );

      return {
        id: registration.id,
        userId: registration.userId,
        agentIp: registration.agentIp,
        agentPort: registration.agentPort,
        status: registration.status,
        createdAt: registration.createdAt,
        message: 'Agent registered successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Error registering agent for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update agent heartbeat timestamp
   */
  async updateHeartbeat(agentId: string): Promise<HeartbeatResponseDto> {
    try {
      // Find agent registration
      const registration = await this.prisma.agentRegistration.findUnique({
        where: { id: agentId },
      });

      if (!registration) {
        throw new NotFoundException(
          `Agent with ID ${agentId} not found`,
        );
      }

      // Update heartbeat timestamp and ensure status is ONLINE
      const updated = await this.prisma.agentRegistration.update({
        where: { id: agentId },
        data: {
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          updatedAt: new Date(),
        },
      });

      this.logger.debug(`Heartbeat received for agent ${agentId}`);

      return {
        success: true,
        agentId: updated.id,
        status: updated.status,
        lastHeartbeat: updated.lastHeartbeat || new Date(),
        message: 'Heartbeat received successfully',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error updating heartbeat for agent ${agentId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get agent registration for a user
   * Checks online status based on heartbeat timestamp (60 second threshold)
   */
  async getAgentByUserId(userId: string): Promise<AgentStatusDto | null> {
    try {
      const registration = await this.prisma.agentRegistration.findUnique({
        where: { userId },
      });

      if (!registration) {
        return null;
      }

      // Check if agent is online (heartbeat within 60 seconds)
      const isOnline: boolean =
        registration.lastHeartbeat != null &&
        Date.now() - registration.lastHeartbeat.getTime() < 60000;

      // If offline (no heartbeat or stale), update status
      if (!isOnline && registration.status === 'ONLINE') {
        await this.markAgentOffline(registration.id);
      }

      return {
        agentId: registration.id,
        userId: registration.userId,
        agentIp: registration.agentIp,
        agentPort: registration.agentPort,
        status: isOnline ? 'ONLINE' : 'OFFLINE',
        lastHeartbeat: registration.lastHeartbeat,
        agentUrl: `http://${registration.agentIp}:${registration.agentPort}`,
        isOnline,
      };
    } catch (error) {
      this.logger.error(
        `Error getting agent for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Helper: Mark agent as offline
   */
  private async markAgentOffline(agentId: string): Promise<void> {
    try {
      await this.prisma.agentRegistration.update({
        where: { id: agentId },
        data: {
          status: 'OFFLINE',
          updatedAt: new Date(),
        },
      });
      this.logger.warn(`Agent ${agentId} marked as offline`);
    } catch (error) {
      this.logger.error(
        `Error marking agent ${agentId} offline: ${error.message}`,
      );
      // Don't throw - this is a helper method
    }
  }
}
