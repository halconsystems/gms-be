import { ApiProperty } from '@nestjs/swagger';

export class BiometricCaptureItemDto {
  @ApiProperty()
  field: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  imageUrl: string;
}

export class BiometricCapturesResponseDto {
  @ApiProperty({ enum: ['Done', 'Pending'] })
  status: 'Done' | 'Pending';

  @ApiProperty()
  completedFingers: number;

  @ApiProperty()
  totalFingers: number;

  @ApiProperty({ type: [BiometricCaptureItemDto] })
  captures: BiometricCaptureItemDto[];
}
