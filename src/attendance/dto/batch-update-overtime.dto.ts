import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
  ValidateIf,
  IsBoolean,
} from 'class-validator';

export class OvertimeUpdateItem {
  @ApiProperty({
    description: 'Attendance record id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  attendanceId: string;

  @ApiProperty({
    description: 'Overtime flag. Send true to enable overtime, false to disable.',
    example: true,
    type: 'boolean'
  })
  @IsDefined()
  @IsBoolean({ message: 'Overtime must be a boolean value' })
  overtime: boolean;
}

export class BatchUpdateOvertimeDto {
  @ApiProperty({
    type: [OvertimeUpdateItem],
    description: 'Array of attendance records to update with overtime flags',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OvertimeUpdateItem)
  updates: OvertimeUpdateItem[];
}
