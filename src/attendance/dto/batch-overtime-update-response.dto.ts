import { ApiProperty } from '@nestjs/swagger';
import { GuardAttendance } from '../interfaces/guard-attendance.interface';

export class FailedUpdate {
  @ApiProperty()
  success: false;

  @ApiProperty()
  attendanceId: string;

  @ApiProperty()
  error: string;
}

export class BatchOvertimeUpdateResponseDto {
  @ApiProperty({
    description: 'Successfully processed attendance records',
    type: GuardAttendance,
    isArray: true
  })
  successful: GuardAttendance[];

  @ApiProperty({
    description: 'Failed attendance records with error details',
    type: FailedUpdate,
    isArray: true
  })
  failed: FailedUpdate[];

  @ApiProperty({ description: 'Total number of records processed' })
  totalProcessed: number;

  @ApiProperty({ description: 'Total number of successful updates' })
  totalSuccess: number;

  @ApiProperty({ description: 'Total number of failed updates' })
  totalFailed: number;
}