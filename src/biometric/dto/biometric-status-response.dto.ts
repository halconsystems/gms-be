import { ApiProperty } from '@nestjs/swagger';

export class BiometricStatusResponseDto {
  @ApiProperty({ enum: ['Done', 'Pending'] })
  status: 'Done' | 'Pending';

  @ApiProperty()
  completedFingers: number;

  @ApiProperty()
  totalFingers: number;

  @ApiProperty({
    description: 'Per-finger completion map (camelCase field names)',
    example: { rightThumb: true, leftThumb: false },
  })
  fingers: Record<string, boolean>;
}
