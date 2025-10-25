import { ApiProperty } from '@nestjs/swagger';
import { AttendanceEnum } from 'src/common/enums/attendance-enum';

export class GuardAttendance {
  @ApiProperty()
  id: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ enum: AttendanceEnum })
  type: AttendanceEnum;

  @ApiProperty()
  locationId: string;

  @ApiProperty()
  guardId: string;

  @ApiProperty()
  shiftId: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  isHoliday: boolean;

  @ApiProperty()
  overtime: boolean;
}