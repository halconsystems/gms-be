import { ApiProperty } from '@nestjs/swagger';

export class AgentStatusDto {
  @ApiProperty({
    description: 'Agent registration ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  agentId: string;

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
    description: 'Last heartbeat timestamp',
    nullable: true,
  })
  lastHeartbeat: Date | null;

  @ApiProperty({
    description: 'Full agent URL',
    example: 'http://192.168.100.50:3001',
  })
  agentUrl: string;

  @ApiProperty({
    description: 'Whether agent is currently online',
    example: true,
  })
  isOnline: boolean;
}
