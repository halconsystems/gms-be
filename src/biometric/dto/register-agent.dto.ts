import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterAgentDto {
  @ApiProperty({
    description: 'User ID from agent config file',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Auto-detected private IP address',
    example: '192.168.100.50',
  })
  @IsString()
  agentIp: string;

  @ApiProperty({
    description: 'Agent port number',
    example: 3001,
    default: 3001,
    minimum: 1024,
    maximum: 65535,
  })
  @IsInt()
  @Min(1024)
  @Max(65535)
  @IsOptional()
  agentPort?: number;

  @ApiProperty({
    description: 'Device type',
    example: 'ZKTeco',
    default: 'ZKTeco',
  })
  @IsString()
  @IsOptional()
  deviceType?: string;
}

export class RegisterAgentResponseDto {
  @ApiProperty({
    description: 'Agent registration ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  userId: string;

  @ApiProperty({
    description: 'Agent IP address',
    example: '192.168.100.50',
  })
  agentIp: string;

  @ApiProperty({
    description: 'Agent port',
    example: 3001,
  })
  agentPort: number;

  @ApiProperty({
    description: 'Agent status',
    enum: ['ONLINE', 'OFFLINE'],
    example: 'ONLINE',
  })
  status: string;

  @ApiProperty({
    description: 'Registration creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Success message',
    example: 'Agent registered successfully',
  })
  message: string;
}
