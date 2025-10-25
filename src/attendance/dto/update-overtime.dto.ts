import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDefined } from 'class-validator';

export class UpdateOvertimeDto {
  @ApiProperty({
    description: 'Overtime flag for the attendance record. Send true to enable overtime, false to disable.',
    example: true,
    type: 'boolean',
    required: true,
  })
  @IsDefined()
  @IsBoolean({ message: 'Overtime must be a boolean value' })
  overtime: boolean;
}
