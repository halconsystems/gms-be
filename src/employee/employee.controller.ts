import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BiometricStatusResponseDto } from 'src/biometric/dto/biometric-status-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { AssignSupervisorDto } from './dto/assign-supervisor.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { UpdateAssignSupervisorDto } from './dto/update-assign-supervisor.dto';
import { GuardService } from 'src/guard/guard.service';
import { PrismaService } from 'src/prisma/prisma.service';

@ApiTags('Employee')
@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    @Inject(forwardRef(() => GuardService))
    private readonly guardService: GuardService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  create(
    @Body() createGuardDto: CreateEmployeeDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.create(createGuardDto, organizationId);
  }

  @Get('/by/serviceNumber')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Employee fetched successfully')
  @ApiOperation({
    summary: 'Get employee by service number',
    description:
      'Retrieves an employee using their service number within the organization',
  })
  findByServiceNumber(
    @Query('serviceNumber', ParseIntPipe) serviceNumber: number,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.findByServiceNumber(
      serviceNumber,
      organizationId,
    );
  }

  @Get()
  findAll() {
    return this.employeeService.findAll();
  }

  @Get('/by-organization')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  findAllByOrganizationId(@GetOrganizationId() organizationId: string, @Req() req) {
    return this.employeeService.findEmployeeByOrganizationId(
      organizationId,
      req.user,
    );
  }

  @Get(':id/biometric-status')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Employee biometric status fetched successfully')
  @ApiOperation({ summary: 'Get biometric completion status for an employee' })
  @ApiResponse({ status: 200, type: BiometricStatusResponseDto })
  getBiometricStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.getBiometricStatus(id, organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeeService.findOne(id);
  }

  @Get('/get/supervisors')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  find(@GetOrganizationId() organizationId: string) {
    return this.employeeService.findAllSupervisors(organizationId);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  update(@Param('id') id: string, @Body() updateGuardDto: UpdateEmployeeDto) {
    return this.employeeService.update(id, updateGuardDto);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }

  //region: ASSIGN SUPERVISOR

  @Get('get-assigned-supervisors/:employeeId')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Assigned supervisors fetched successfully')
  getLegacyAssignedSupervisors(
    @Param('employeeId') employeeId: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.getAssignedSupervisorsByEmployeeId(
      employeeId,
      organizationId,
    );
  }

  @Get('supervisors/by-service-number/:serviceNumber/any')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Assigned supervisors fetched successfully')
  async getAssignedSupervisorsByServiceNumberAny(
    @Param('serviceNumber', ParseIntPipe) serviceNumber: number,
    @GetOrganizationId() organizationId: string,
    @Query('personType') personType?: 'guard' | 'employee',
  ) {
    console.log(
      'Fetching any supervisor for service number:',
      serviceNumber,
      'personType:',
      personType,
    );
    let employeeId: string | null = null;
    let detectedType: 'guard' | 'employee';

    // First determine if we're dealing with a guard or employee
    if (personType === 'guard') {
      // Try only Guard
      const guard = await this.guardService.findByServiceNumber(
        serviceNumber,
        organizationId,
      );
      if (!guard) {
        throw new NotFoundException(
          `Guard with service number ${serviceNumber} not found`,
        );
      }
      detectedType = 'guard';
      // Map guard to employee, but don't create if missing
      employeeId = await this.guardService.resolveEmployeeIdForGuard(
        guard.id,
        organizationId,
        false,
      );
      if (employeeId) {
        const guardUser = await this.prisma.guard.findUnique({
          where: { id: guard.id },
          select: { user: true },
        });
        const hasUserRole = await this.employeeService.hasSupervisorRole(
          guardUser?.user?.id || null,
        );
        if (hasUserRole) {
          const assignments =
            await this.employeeService.getAssignmentsBySupervisorId(
              employeeId,
              organizationId,
            );
          return { data: assignments };
        }
      }
      const supervisors =
        await this.employeeService.getAssignedSupervisorsByEmployeeId(
          employeeId || '',
          organizationId,
        );
      return { data: supervisors };
    } else if (personType === 'employee') {
      // Try only Employee
      const employee = await this.employeeService.findByServiceNumber(
        serviceNumber,
        organizationId,
      );
      if (!employee) {
        throw new NotFoundException(
          `Employee with service number ${serviceNumber} not found`,
        );
      }
      detectedType = 'employee';
      employeeId = employee.id;

      // For employees, check if they are a supervisor and return their assignments
      const hasUserRole = await this.employeeService.hasSupervisorRole(
        employee.userId,
      );
      if (hasUserRole) {
        // Get their assignments as a supervisor
        const assignments =
          await this.employeeService.getAssignmentsBySupervisorId(
            employee.id,
            organizationId,
          );
        return { data: assignments };
      } else {
        // Get who supervises them
        const supervisors =
          await this.employeeService.getAssignedSupervisorsByEmployeeId(
            employee.id,
            organizationId,
          );
        return { data: supervisors };
      }
    } else {
      // Try both (Guard first)
      try {
        const guard = await this.guardService.findByServiceNumber(
          serviceNumber,
          organizationId,
        );
        if (guard) {
          detectedType = 'guard';
          const resolvedId = await this.guardService.resolveEmployeeIdForGuard(
            guard.id,
            organizationId,
            false,
          );
          if (!resolvedId) {
            return { data: [] };
          }
          employeeId = resolvedId;
        } else {
          // If guard not found, try employee
          const employee = await this.employeeService.findByServiceNumber(
            serviceNumber,
            organizationId,
          );
          if (employee) {
            detectedType = 'employee';
            employeeId = employee.id;
          } else {
            throw new NotFoundException(
              `No guard or employee found with service number ${serviceNumber}`,
            );
          }
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw error;
        }
        throw new NotFoundException(
          `Error retrieving person with service number ${serviceNumber}: ${error.message}`,
        );
      }
    }

    if (!employeeId) {
      return { data: [] };
    }
    const supervisors =
      await this.employeeService.getAssignedSupervisorsByEmployeeId(
        employeeId,
        organizationId,
      );
    return { data: supervisors };
  }

  @Get('by-service-number/:serviceNumber')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Assigned supervisors fetched successfully')
  async getAssignedSupervisorsByServiceNumber(
    @Param('serviceNumber', ParseIntPipe) serviceNumber: number,
    @GetOrganizationId() organizationId: string,
  ) {
    const employee = await this.employeeService.findByServiceNumber(
      serviceNumber,
      organizationId,
    );
    if (!employee) {
      throw new NotFoundException(
        `Employee with service number ${serviceNumber} not found`,
      );
    }
    const supervisors =
      await this.employeeService.getAssignedSupervisorsByEmployeeId(
        employee.id,
        organizationId,
      );
    return { data: supervisors };
  }

  @Post('assign-supervisor')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Supervisor assigned successfully')
  assignSupervisor(
    @Body() assignSupervisorDto: AssignSupervisorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.assignSupervisor(
      assignSupervisorDto,
      organizationId,
    );
  }

  @Patch('update-assigned-supervisor/:assignedSupervisorId')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Assigned Supervisor updated successfully')
  updateSupervisor(
    @Param('assignedSupervisorId') id: string,
    @Body() dto: UpdateAssignSupervisorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.employeeService.updateAssignedSupervisor(
      dto,
      id,
      organizationId,
    );
  }
  //endregion
}
