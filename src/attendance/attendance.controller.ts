import {
  Body,
  Controller,
  BadRequestException,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { Roles } from 'src/common/decorators/role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { CreateGuardAttendanceDto } from './dto/create-guard-attendance.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UpdateGuardAttendanceDto } from './dto/update-guard-attendance.dto';
import { BatchCreateGuardAttendanceDto } from './dto/batch-create-guard-attendance.dto';
import { IBatchAttendanceResponse } from './interfaces/attendance-response.interface';
import { UpdateOvertimeDto } from './dto/update-overtime.dto';
import { BatchUpdateOvertimeDto } from './dto/batch-update-overtime.dto';
import { BatchOvertimeUpdateResponseDto } from './dto/batch-overtime-update-response.dto';
import { GuardAttendance } from './interfaces/guard-attendance.interface';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('/guard')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RolesEnum.organizationAdmin,
    RolesEnum.manager,
    RolesEnum.supervisor,
    RolesEnum.guardSupervisor,
  )
  @ResponseMessage('Guard Attendance created successfully')
  @ApiBody({
    type: CreateGuardAttendanceDto,
    isArray: true,
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Guard attendance records created successfully',
    type: BatchCreateGuardAttendanceDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid attendance data',
  })
  async create(
    @Body() dtoList: CreateGuardAttendanceDto[],
    @GetOrganizationId() organizationId: string,
    @Req() req?: any,
  ): Promise<IBatchAttendanceResponse> {
    return this.attendanceService.create(dtoList, organizationId, req?.user);
  }

  @Patch('/guard/:attendanceId/overtime')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RolesEnum.organizationAdmin,
    RolesEnum.manager,
    RolesEnum.supervisor,
    RolesEnum.guardSupervisor,
  )
  @ResponseMessage('Overtime flag updated successfully')
  @ApiBody({ type: UpdateOvertimeDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Overtime flag updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Attendance record not found' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid overtime data or attendance type' })
  @ApiResponse({ status: HttpStatus.OK, type: GuardAttendance })
  async updateOvertime(
    @Param('attendanceId', new ParseUUIDPipe()) attendanceId: string,
    @Body() dto: UpdateOvertimeDto,
    @GetOrganizationId() organizationId: string,
    @Req() req?: any,
  ): Promise<GuardAttendance> {
    return this.attendanceService.updateOvertimeSingle(
      attendanceId,
      dto.overtime,
      organizationId,
      req?.user,
    );
  }

  @Patch('/guard/overtime')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RolesEnum.organizationAdmin,
    RolesEnum.manager,
    RolesEnum.supervisor,
    RolesEnum.guardSupervisor,
  )
  @ResponseMessage('Batch overtime update completed')
  @ApiBody({ type: BatchUpdateOvertimeDto, description: 'Array of attendance records to update with overtime flags' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Batch overtime update completed with summary', type: BatchOvertimeUpdateResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid batch update data' })
  async updateOvertimeBatch(
    @Body() dto: BatchUpdateOvertimeDto,
    @GetOrganizationId() organizationId: string,
    @Req() req?: any,
  ): Promise<BatchOvertimeUpdateResponseDto> {
    return this.attendanceService.updateOvertimeBatch(dto.updates, organizationId, req?.user);
  }

  //  @Patch("/guard/update")
  //  @ApiBearerAuth('jwt')
  //  @UseGuards(JwtAuthGuard, RolesGuard)
  //  @Roles(RolesEnum.organizationAdmin)
  //  @ResponseMessage("Guard Attendance created successfully")
  //  @ApiBody({
  //     type: UpdateGuardAttendanceDto,
  //     isArray: true
  //   })
  //  update(@Body() dtoList: UpdateGuardAttendanceDto[], @GetOrganizationId() organizationId: string) {
  //    return this.attendanceService.update(dtoList, organizationId);
  //  }

  @Get('/guard/all')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RolesEnum.organizationAdmin,
    RolesEnum.manager,
    RolesEnum.supervisor,
    RolesEnum.guardSupervisor,
    RolesEnum.staff,
  )
  @ResponseMessage('Guard Attendance fetched successfully')
  findAll(@GetOrganizationId() organizationId: string, @Req() req) {
    return this.attendanceService.findAll(organizationId, req?.user);
  }

  @Get('/location/guard/:locationId')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    RolesEnum.organizationAdmin,
    RolesEnum.manager,
    RolesEnum.supervisor,
    RolesEnum.guardSupervisor,
  )
  @ResponseMessage('Guard Attendance fetched successfully')
  @ApiQuery({ name: 'serviceNumber', required: false, type: Number })
  @ApiQuery({ name: 'officeId', required: false, type: Number })
  findGuardAttendanceByLocationId(
    @GetOrganizationId() organizationId: string,
    @Param('locationId') locationId: string,
    @Query('from') from: Date,
    @Query('to') to: Date,
    @Query('serviceNumber') serviceNumber?: number,
    @Query('officeId') officeId?: string,
    @Req() req?: any,
  ) {
    return this.attendanceService.findGuardAttendanceByLocationId(
      locationId,
      organizationId,
      from,
      to,
      serviceNumber,
      officeId,
      req?.user,
    );
  }

  //  @Get('/by-organization')
  //  @ApiBearerAuth('jwt')
  //  @UseGuards(JwtAuthGuard, RolesGuard)
  //  @Roles(RolesEnum.organizationAdmin)
  //  findAllByOrganizationId(@GetOrganizationId() organizationId: string) {
  //    return this.attendanceService.findEmployeeByOrganizationId(organizationId);
  //  }

  //  @Get(':id')
  //  findOne(@Param('id') id: string) {
  //    return this.attendanceService.findOne(id);
  //  }

  //  @Patch(':id')
  //  @ApiBearerAuth('jwt')
  //  @UseGuards(JwtAuthGuard, RolesGuard)
  //  @Roles(RolesEnum.organizationAdmin)
  //  update(@Param('id') id: string, @Body() updateGuardDto: UpdateEmployeeDto) {
  //    return this.attendanceService.update(id, updateGuardDto);
  //  }

  @Delete('/guard/:id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Guard Attendance deleted successfully')
  remove(@Param('id') id: string) {
    return this.attendanceService.deleteGuardAttendance(id);
  }
}
