import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGuardAttendanceDto } from './dto/create-guard-attendance.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { AttendanceEnum } from 'src/common/enums/attendance-enum';
import {
  startOfDay,
  addDays,
  startOfMonth,
  addMonths,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns';
import { UpdateGuardAttendanceDto } from './dto/update-guard-attendance.dto';
import { BatchCreateGuardAttendanceDto } from './dto/batch-create-guard-attendance.dto';
import {
  IBatchAttendanceResponse,
  IAttendanceResponse,
} from './interfaces/attendance-response.interface';
import { BatchOvertimeUpdateResponseDto, FailedUpdate } from './dto/batch-overtime-update-response.dto';
import { GuardAttendance } from './interfaces/guard-attendance.interface';
import { BATCH_CHUNK_SIZE } from './constants';
import { ENFORCE_PRESENT_ONLY_OVERTIME } from './config/attendance.config';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateAttendanceEntry(
    dto: CreateGuardAttendanceDto,
    organizationId: string,
  ): Promise<IAttendanceResponse> {
    try {
      // Check if guard exists and belongs to the organization
      const guard = await this.prisma.guard.findFirst({
        where: {
          id: dto.guardId,
          organizationId,
        },
      });

      if (!guard) {
        return {
          success: false,
          error: `Guard with ID ${dto.guardId} not found or doesn't belong to the organization`,
        };
      }

      // Check if location exists and belongs to the organization
      const location = await this.prisma.location.findFirst({
        where: {
          id: dto.locationId,
          organizationId,
        },
      });

      if (!location) {
        return {
          success: false,
          error: `Location with ID ${dto.locationId} not found or doesn't belong to the organization`,
        };
      }

      // Check for duplicate attendance
      const existingAttendance = await this.prisma.guardsAttendance.findFirst({
        where: {
          guardId: dto.guardId,
          date: parseISO(dto.date),
          locationId: dto.locationId,
        },
      });

      if (existingAttendance) {
        return {
          success: false,
          error: `Attendance record already exists for guard on ${dto.date}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
      };
    }
  }

  async createSingle(
    dto: CreateGuardAttendanceDto,
    organizationId: string,
  ): Promise<IAttendanceResponse> {
    const validation = await this.validateAttendanceEntry(dto, organizationId);

    if (!validation.success) {
      return validation;
    }

    try {
      const attendance = await this.prisma.guardsAttendance.create({
        data: {
          guardId: dto.guardId,
          locationId: dto.locationId,
          shiftId: dto.shiftId,
          type: dto.type,
          date: parseISO(dto.date),
        },
      });

      return {
        success: true,
        data: {
          id: attendance.id,
          guardId: attendance.guardId,
          locationId: attendance.locationId,
          shiftId: attendance.shiftId,
          type: attendance.type as AttendanceEnum,
          date: attendance.date,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create attendance: ${error.message}`,
      };
    }
  }

  async create(
    dtoList: CreateGuardAttendanceDto[],
    organizationId: string,
  ): Promise<IBatchAttendanceResponse> {
    const response: IBatchAttendanceResponse = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    // Process attendance records in parallel with a limit to prevent overload
    for (let i = 0; i < dtoList.length; i += BATCH_CHUNK_SIZE) {
      const chunk = dtoList.slice(i, i + BATCH_CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((dto) => this.createSingle(dto, organizationId)),
      );

      for (const result of results) {
        response.totalProcessed++;
        if (result.success) {
          response.successful.push(result);
          response.totalSuccess++;
        } else {
          response.failed.push(result);
          response.totalFailed++;
        }
      }
    }

    return response;
  }

  async update(dtoList: UpdateGuardAttendanceDto[], organizationId: string) {
    try {
      const errors: string[] = [];
      const validDtos: UpdateGuardAttendanceDto[] = [];
      for (const dto of dtoList) {
        const existing = await this.prisma.guardsAttendance.findFirst({
          where: {
            id: dto.id,
          },
        });
        if (!existing) {
          throw new NotFoundException(
            `Attendance for guard ${dto.guardId} on ${dto.date} does not exist`,
          );
        }
        if (!Object.values(AttendanceEnum).includes(AttendanceEnum[dto.type])) {
          throw new ForbiddenException(
            `Invalid attendance type ${dto.type} for guard ${dto.guardId}`,
          );
        }

        validDtos.push({
          ...dto,
          type: AttendanceEnum[dto.type],
        });
      }

      const attendance = await this.prisma.guardsAttendance.updateManyAndReturn(
        {
          data: validDtos,
        },
      );

      return attendance;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateOvertimeSingle(
    attendanceId: string,
    overtime: boolean,
    organizationId: string,
  ): Promise<GuardAttendance> {
    try {
      const existingAttendance = await this.prisma.guardsAttendance.findFirst({
        where: {
          id: attendanceId,
          location: {
            organizationId,
          },
        },
      });

      if (!existingAttendance) {
        throw new NotFoundException("Attendance record not found or doesn't belong to the organization");
      }

      // Optional enforcement of Present-only overtime based on environment configuration
      // This check is skipped when ENFORCE_PRESENT_ONLY_OVERTIME is false, allowing overtime
      // to be set on any attendance type per business requirements
      if (ENFORCE_PRESENT_ONLY_OVERTIME && overtime === true && (existingAttendance.type as AttendanceEnum) !== AttendanceEnum.P) {
        throw new BadRequestException('Overtime can only be set for Present (P) attendance records when enforcement is enabled');
      }
      
      const updated = await this.prisma.guardsAttendance.update({
        where: { id: attendanceId },
        data: { overtime },
      });

      const mappedResponse: GuardAttendance = {
        ...updated,
        type: updated.type as AttendanceEnum,
        overtime: updated.overtime ?? false, // Ensure overtime is never null
      };

      return mappedResponse;
    } catch (error) {
      handlePrismaError(error);
      // This line is never reached as handlePrismaError always throws
      throw new Error('Unreachable - handlePrismaError should always throw');
    }
  }

  async updateOvertimeBatch(
    updates: Array<{ attendanceId: string; overtime: boolean }>,
    organizationId: string,
  ): Promise<BatchOvertimeUpdateResponseDto> {
    const response: BatchOvertimeUpdateResponseDto = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };

    try {
      // Process updates in chunks to prevent overload
      for (let i = 0; i < updates.length; i += BATCH_CHUNK_SIZE) {
        const chunk = updates.slice(i, i + BATCH_CHUNK_SIZE);
        const results = await Promise.all(
          chunk.map(async (update) => {
            try {
              const result = await this.updateOvertimeSingle(
                update.attendanceId,
                update.overtime,
                organizationId,
              );
              return { success: true as const, data: result };
            } catch (error) {
              let errorMessage: string;
              if (error instanceof HttpException) {
                const response = error.getResponse();
                if (typeof response === 'string') {
                  errorMessage = response;
                } else if (typeof response === 'object' && 'message' in response) {
                  const message = response.message;
                  errorMessage = Array.isArray(message) ? message.join(', ') : String(message);
                } else {
                  errorMessage = error.message;
                }
              } else {
                errorMessage = String(error);
              }
              return {
                success: false as const,
                attendanceId: update.attendanceId,
                error: errorMessage,
              };
            }
          }),
        );

        for (const result of results) {
          response.totalProcessed++;
          if (result.success) {
            if (result.data) {
              response.successful.push(result.data);
            }
            response.totalSuccess++;
          } else {
            const failedUpdate: FailedUpdate = {
              success: false,
              attendanceId: result.attendanceId,
              error: result.error
            };
            response.failed.push(failedUpdate);
            response.totalFailed++;
          }
        }
      }

      return response;
    } catch (error) {
      handlePrismaError(error);
      // This line is never reached as handlePrismaError always throws
      throw new Error('Unreachable - handlePrismaError should always throw');
    }
  }

  async findAll(organizationId: string) {
    try {
      return await this.prisma.guardsAttendance.findMany({
        where: {
          location: {
            organizationId: organizationId,
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findGuardAttendanceByLocationId(
    locationId: string,
    organizationId: string,
    from: Date,
    to: Date,
    serviceNumber?: number,
    officeId?: string,
  ) {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId, organizationId: organizationId },
      });
      if (!location) throw new NotFoundException('Location Not Found');

      // const start = startOfMonth(date);
      // const end = addMonths(start, 1);

      const fromDate = new Date(from);
      const toDate = new Date(to);

      console.log(fromDate);
      console.log(toDate);

      const totalDays = differenceInCalendarDays(toDate, fromDate);

      const guardWhereCondition: any = {
        officeId: officeId || null,
        organizationId,
        assignedGuard: {
          some: {
            locationId,
          },
        },
      };

      if (serviceNumber) {
        guardWhereCondition.serviceNumber = serviceNumber;
        const guard = await this.prisma.guard.findFirst({
          where: guardWhereCondition,
        });
        if (!guard)
          throw new NotFoundException(
            'No guard exists with given serviceNumber',
          );
      }

      const guards = await this.prisma.guard.findMany({
        where: guardWhereCondition,
        select: {
          id: true,
          fullName: true,
          serviceNumber: true,
          fatherName: true,
          organizationId: true,
          officeId: true,
          assignedGuard: {
            select: {
              deploymentDate: true,
              deploymentTill: true,
            },
          },
          guardsAttendance: {
            where: {
              date: {
                gte: fromDate,
                lte: toDate,
              },
            },
          },
        },
      });

      const result = guards.map((guard) => {
        let P = 0,
          A = 0,
          R = 0,
          L = 0;

        for (const att of guard.guardsAttendance) {
          if (att.type === 'P') P++;
          else if (att.type === 'R') R++;
          else if (att.type === 'A') A++;
          else if (att.type === 'L') L++;
        }

        const totalRecorded = P + R + L + A;
        //   const missing = totalDays - totalRecorded;
        //   A += missing;

        return {
          id: guard.id,
          organizationId: guard.organizationId,
          officeId: guard.officeId,
          fullName: guard.fullName,
          serviceNumber: guard.serviceNumber,
          fatherName: guard.fatherName,
          assignedGuard: guard.assignedGuard,
          attendanceStats: {
            P,
            R,
            L,
            A,
          },
          guardAttendance: guard.guardsAttendance,
        };
      });

      return {
        dateRange: {
          from: fromDate,
          to: toDate,
          totalDays,
        },
        result,
      };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async deleteGuardAttendance(attendanceId: string) {
    try {
      const attendance = await this.prisma.guardsAttendance.findUnique({
        where: { id: attendanceId },
      });
      if (!attendance) throw new NotFoundException('Attendance Not Found');

      await this.prisma.guardsAttendance.delete({
        where: { id: attendanceId },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
