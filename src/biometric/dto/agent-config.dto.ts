import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveAgentConfigDto {
  @ApiProperty({
    description: 'User ID that this agent config belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'IP address of the fingerprint agent',
    example: '192.168.1.50'
  })
  @IsString()
  agentIp: string;

  @ApiProperty({
    description: 'Port number for the fingerprint agent (default: 8765)',
    example: 8765,
    required: false
  })
  @IsOptional()
  @IsInt()
  @Min(1024)
  @Max(65535)
  agentPort?: number;
}

export class AgentConfigResponseDto {
  @ApiProperty({
    description: 'Config record ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000'
  })
  userId: string;

  @ApiProperty({
    description: 'Agent IP address',
    example: '192.168.1.50'
  })
  agentIp: string;

  @ApiProperty({
    description: 'Agent port',
    example: 8765
  })
  agentPort: number;

  @ApiProperty({
    description: 'When the config was created',
    example: '2025-12-04T10:30:00Z'
  })
  configuredAt: Date;

  @ApiProperty({
    description: 'When the config was last updated',
    example: '2025-12-04T10:30:00Z'
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Whether this config is active',
    example: true
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Full agent URL',
    example: 'http://192.168.1.50:8765'
  })
  agentUrl: string;
}

export class AgentConfigDeleteResponseDto {
  @ApiProperty({
    description: 'Success message'
  })
  message: string;

  @ApiProperty({
    description: 'Deleted config ID'
  })
  configId: string;
}
