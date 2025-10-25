import { AttendanceEnum } from 'src/common/enums/attendance-enum';

export interface IAttendanceResponse {
  success: boolean;
  data?: {
    id: string;
    guardId: string;
    locationId: string;
    shiftId: string;
    type: AttendanceEnum;
    date: Date;
  };
  error?: string;
}

export interface IBatchAttendanceResponse {
  successful: IAttendanceResponse[];
  failed: IAttendanceResponse[];
  totalProcessed: number;
  totalSuccess: number;
  totalFailed: number;
}
