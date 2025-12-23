import { ApiProperty } from '@nestjs/swagger';

export class HeartbeatDto {
  // Empty DTO - agentId comes from URL parameter
}

export class HeartbeatResponseDto {
  @ApiProperty({
    description: 'Success flag',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Agent registration ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  agentId: string;

  @ApiProperty({
    description: 'Agent status',
    enum: ['ONLINE', 'OFFLINE'],
    example: 'ONLINE',
  })
  status: string;

  @ApiProperty({
    description: 'Last heartbeat timestamp',
  })
  lastHeartbeat: Date;

  @ApiProperty({
    description: 'Success message',
    example: 'Heartbeat received',
  })
  message: string;
}
