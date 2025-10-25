import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateGuardAttendanceDto } from './create-guard-attendance.dto';

export class BatchCreateGuardAttendanceDto {
  @ApiProperty({ type: [CreateGuardAttendanceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGuardAttendanceDto)
  attendanceRecords: CreateGuardAttendanceDto[];
}
