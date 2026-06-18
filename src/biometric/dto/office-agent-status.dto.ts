import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OfficeAgentStatusDto {
  @ApiProperty({
    description: 'Office agent connection status',
    enum: ['ONLINE', 'OFFLINE'],
    example: 'ONLINE',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Last time the office agent was seen (WS connect/disconnect)',
    nullable: true,
  })
  lastSeenAt: Date | null;

  @ApiProperty({
    description: 'Whether the office agent is currently connected via WebSocket',
    example: true,
  })
  isOnline: boolean;
}
