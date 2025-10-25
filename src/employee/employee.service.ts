import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { GuardService } from 'src/guard/guard.service';
import { UpdateGuardDto } from 'src/guard/dto/update-guard-dto';
import { UserService } from 'src/user/user.service';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { NotFoundError } from 'rxjs';
import { AssignSupervisorDto } from './dto/assign-supervisor.dto';
import { UpdateAssignSupervisorDto } from './dto/update-assign-supervisor.dto';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly user: UserService,
    @Inject(forwardRef(() => GuardService))
    private readonly guardService: GuardService,
  ) {}

  async create(data: CreateEmployeeDto, organizationId: string) {
    try {
      // Get next service number
      const lastEmployee = await this.prisma.employee.findFirst({
        where: { organizationId },
        orderBy: { serviceNumber: 'desc' },
      });

      const nextServiceNumber = lastEmployee
        ? lastEmployee.serviceNumber + 1
        : 1;
      console.log(
        `Assigning service number ${nextServiceNumber} to employee in organization ${organizationId}`,
      );

      // Prepare create data object
      const createData: any = {
        ...data,
        serviceNumber: nextServiceNumber,
        userId: null,
        organizationId,
      };

      // Add relations if they exist
      if (data.academic) {
        createData.academic = { create: data.academic };
      }

      if (data.drivingLicense) {
        createData.drivingLicense = { create: data.drivingLicense };
      }

      if (data.bankAccount) {
        createData.bankAccount = { create: data.bankAccount };
      }

      if (data.employeeDocuments) {
        createData.employeeDocuments = { create: data.employeeDocuments };
      }

      // Handle optional relations with proper checks
      if (Array.isArray(data.employeeExperience)) {
        createData.employeeExperience =
          data.employeeExperience.length > 0
            ? { create: data.employeeExperience }
            : undefined;
      }

      // Handle references - properly handle empty array case
      if (Array.isArray(data.references)) {
        createData.references =
          data.references.length > 0
            ? {
                create: data.references.map((ref) => ({
                  fullName: ref.name || '',
                  fatherName: ref.fatherName || '',
                  cnicNumber: ref.cnicNumber || '',
                  contactNumber: ref.contactNumber || '',
                  currentAddress: ref.currentAddress || '',
                  permanentAddress: ref.permanentAddress || '',
                  cnicFront: ref.cnicFront || '',
                  cnicBack: ref.cnicBack || '',
                })),
              }
            : undefined;
      }

      // Handle optional biometric data
      if (data.biometric) {
        // Only create biometric if at least one field has a value
        const hasBiometricData = Object.values(data.biometric).some(
          (value) => value !== '' && value !== undefined && value !== null,
        );
        createData.biometric = hasBiometricData
          ? { create: data.biometric }
          : undefined;
      }

      // Create employee with prepared data
      return await this.prisma.employee.create({
        data: createData,
        include: {
          academic: true,
          drivingLicense: true,
          employeeExperience: true,
          references: true,
          bankAccount: true,
          biometric: true,
          employeeDocuments: true,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findByServiceNumber(serviceNumber: number, organizationId: string) {
    try {
      const employee = await this.prisma.employee.findUnique({
        where: {
          organizationId_serviceNumber: {
            organizationId,
            serviceNumber,
          },
        },
        include: {
          academic: true,
          drivingLicense: true,
          employeeExperience: true,
          references: true,
          bankAccount: true,
          biometric: true,
          employeeDocuments: true,
        },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with service number ${serviceNumber} not found in organization ${organizationId}`,
        );
      }

      return employee;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findAll() {
    return this.prisma.employee.findMany({
      include: {
        academic: true,
        drivingLicense: true,
        employeeExperience: true,
        references: true,
        bankAccount: true,
        biometric: true,
      },
    });
  }

  async findAllSupervisors(organizationId: string) {
    try {
      const supervisorRole = await this.prisma.role.findFirst({
        where: { roleName: RolesEnum.supervisor },
      });

      if (!supervisorRole)
        throw new NotFoundException("supervisor role doesn't exist");

      return this.prisma.employee.findMany({
        where: {
          organizationId: organizationId,
          user: {
            userRoles: {
              some: {
                roleId: supervisorRole?.id,
              },
            },
          },
        },
        include: {
          academic: true,
          drivingLicense: true,
          employeeExperience: true,
          references: true,
          bankAccount: true,
          biometric: true,
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  findOne(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        academic: true,
        drivingLicense: true,
        employeeExperience: true,
        references: true,
        bankAccount: true,
        biometric: true,
      },
    });
  }

  findEmployeeByOrganizationId(organizationId: string) {
    return this.prisma.employee.findMany({
      where: { organizationId: organizationId },
      include: {
        academic: true,
        drivingLicense: true,
        employeeExperience: true,
        references: true,
        bankAccount: true,
        biometric: true,
      },
    });
  }

  async update(id: string, data: UpdateEmployeeDto) {
    const {
      academic,
      drivingLicense,
      employeeExperience,
      references,
      bankAccount,
      employeeDocuments,
      biometric,
      ...guardData
    } = data;

    const updatedGuard = await this.prisma.employee.update({
      where: { id },
      data: guardData,
    });

    if (academic) {
      await this.prisma.academic.update({
        where: { guardId: id },
        data: academic,
      });
    }

    if (drivingLicense) {
      await this.prisma.drivingLicense.update({
        where: { guardId: id },
        data: drivingLicense,
      });
    }

    if (bankAccount) {
      await this.prisma.bankAccount.update({
        where: { guardId: id },
        data: bankAccount,
      });
    }

    // Handle optional biometric data
    if (biometric && Object.values(biometric).some((value) => value !== '')) {
      const existingBiometric = await this.prisma.biometric.findUnique({
        where: { guardId: id },
      });

      if (existingBiometric) {
        await this.prisma.biometric.update({
          where: { guardId: id },
          data: biometric,
        });
      } else {
        await this.prisma.biometric.create({
          data: {
            ...biometric,
            guardId: id,
          },
        });
      }
    }

    if (employeeExperience && employeeExperience.length > 0) {
      await this.prisma.employeeExperience.deleteMany({
        where: { employeeId: id },
      });

      await this.prisma.employeeExperience.createMany({
        data: employeeExperience.map((exp) => ({ ...exp, guardId: id })),
      });
    }

    if (references && references.length > 0) {
      // First delete existing references
      await this.prisma.reference.deleteMany({
        where: { guardId: id },
      });

      // Then create new references with the correct field mapping
      await this.prisma.reference.createMany({
        data: references.map((ref) => ({
          guardId: id,
          fullName: ref.name || '', // Map name to fullName
          fatherName: ref.fatherName || '',
          cnicNumber: ref.cnicNumber || '',
          contactNumber: ref.contactNumber || '',
          currentAddress: ref.currentAddress || '',
          permanentAddress: ref.permanentAddress || '',
          cnicFront: ref.cnicFront || '',
          cnicBack: ref.cnicBack || '',
        })),
      });
    }

    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        academic: true,
        drivingLicense: true,
        employeeExperience: true,
        references: true,
        bankAccount: true,
        biometric: true,
      },
    });
  }

  remove(id: string) {
    return this.prisma.employee.delete({ where: { id } });
  }

  //#region : ASSIGN SUPERVISOR
  /**
   * Check if a user has the supervisor role
   * @param userId The user ID to check
   * @returns true if the user has the supervisor role, false otherwise
   */
  async hasSupervisorRole(userId: string | null): Promise<boolean> {
    if (!userId) return false;

    const supervisorRole = await this.prisma.role.findFirst({
      where: { roleName: RolesEnum.supervisor },
    });

    if (!supervisorRole) return false;

    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId: userId,
        roleId: supervisorRole.id,
      },
    });

    return !!userRole;
  }
  /**
   * Assign a supervisor role and location to an Employee
   * @param dto DTO containing supervisor assignment details
   * @param organizationId Organization ID for security scope
   * @remarks This endpoint only handles Employee service numbers. For Guard service numbers,
   * use the `POST /guards/promote-to-supervisor` endpoint instead. This separation ensures
   * clear responsibility boundaries and proper role assignment flows.
   */
  async assignSupervisor(dto: AssignSupervisorDto, organizationId: string) {
    try {
      // Validate location and client
      const location = await this.prisma.location.findUnique({
        where: {
          id: dto.locationId,
          clientId: dto.clientId,
          organizationId: organizationId,
        },
      });
      const client = await this.prisma.client.findUnique({
        where: { id: dto.clientId, organizationId: organizationId },
      });

      if (!location)
        throw new NotFoundException(
          "Location doesn't exist for this organization",
        );
      if (!client)
        throw new NotFoundException(
          "Client doesn't exist for this organization",
        );

      // Resolve employee ID (person being assigned a supervisor) from either service number or direct ID
      let employeeId: string;
      if (dto.serviceNumber !== undefined) {
        // First try to find as a Guard
        try {
          const guard = await this.guardService.findByServiceNumber(
            dto.serviceNumber,
            organizationId,
          );
          if (guard) {
            // Map guard to employee ID and create if needed
            const resolvedEmployeeId =
              await this.guardService.resolveEmployeeIdForGuard(
                guard.id,
                organizationId,
                true,
              );
            if (!resolvedEmployeeId) {
              throw new NotFoundException(
                `Failed to resolve employee record for guard with service number ${dto.serviceNumber}`,
              );
            }
            employeeId = resolvedEmployeeId;
          } else {
            // If not found as guard, try as employee
            const employee = await this.findByServiceNumber(
              dto.serviceNumber,
              organizationId,
            );
            if (!employee) {
              throw new NotFoundException(
                `No person found with service number ${dto.serviceNumber}`,
              );
            }
            employeeId = employee.id;
          }
        } catch (error) {
          // If guard lookup fails, try employee
          const employee = await this.findByServiceNumber(
            dto.serviceNumber,
            organizationId,
          );
          if (!employee) {
            throw new NotFoundException(
              `No person found with service number ${dto.serviceNumber}`,
            );
          }
          employeeId = employee.id;
        }
      } else if (dto.employeeId !== undefined) {
        // Verify employee exists and belongs to organization
        const employee = await this.prisma.employee.findFirst({
          where: {
            id: dto.employeeId,
            organizationId,
          },
        });
        if (!employee) {
          throw new NotFoundException(
            `Employee with ID ${dto.employeeId} not found in this organization`,
          );
        }
        employeeId = dto.employeeId;
      } else {
        throw new BadRequestException(
          'Either serviceNumber or employeeId must be provided',
        );
      }

      // Resolve supervisor's employee ID from either service number or direct ID
      let supervisorEmployeeId: string;
      if (dto.supervisorServiceNumber !== undefined) {
        // First try to find a Guard by service number
        try {
          const guardSupervisor = await this.guardService.findByServiceNumber(
            dto.supervisorServiceNumber,
            organizationId,
          );
          if (guardSupervisor) {
            // Map guard to employee ID
            const employeeId =
              await this.guardService.resolveEmployeeIdForGuard(
                guardSupervisor.id,
                organizationId,
                true,
              );
            if (!employeeId) {
              throw new NotFoundException(
                `Failed to resolve employee record for guard supervisor with service number ${dto.supervisorServiceNumber}`,
              );
            }
            supervisorEmployeeId = employeeId;
          } else {
            // If not found as guard, try as employee
            const employeeSupervisor = await this.findByServiceNumber(
              dto.supervisorServiceNumber,
              organizationId,
            );
            if (!employeeSupervisor) {
              throw new NotFoundException(
                `No supervisor found with service number ${dto.supervisorServiceNumber}`,
              );
            }
            supervisorEmployeeId = employeeSupervisor.id;
          }
        } catch (error) {
          // If guard lookup fails, try employee
          const employeeSupervisor = await this.findByServiceNumber(
            dto.supervisorServiceNumber,
            organizationId,
          );
          if (!employeeSupervisor) {
            throw new NotFoundException(
              `No supervisor found with service number ${dto.supervisorServiceNumber}`,
            );
          }
          supervisorEmployeeId = employeeSupervisor.id;
        }
      } else if (dto.supervisorEmployeeId !== undefined) {
        // Verify supervisor exists and belongs to organization
        const supervisor = await this.prisma.employee.findFirst({
          where: {
            id: dto.supervisorEmployeeId,
            organizationId,
          },
        });
        if (!supervisor) {
          throw new NotFoundException(
            `Supervisor with ID ${dto.supervisorEmployeeId} not found in this organization`,
          );
        }
        supervisorEmployeeId = dto.supervisorEmployeeId;
      } else {
        throw new BadRequestException(
          'Either supervisorServiceNumber or supervisorEmployeeId must be provided',
        );
      }

      const assignSupervisor = await this.prisma.assignedSupervisor.create({
        data: {
          locationId: dto.locationId,
          clientId: dto.clientId,
          employeeId: employeeId,
          supervisorEmployeeId: supervisorEmployeeId,
          deploymentDate: new Date(),
          deploymentTill: dto.deploymentTill
            ? new Date(dto.deploymentTill)
            : undefined,
        },
        include: {
          location: true,
          client: true,
          employee: true,
        },
      });
      return assignSupervisor;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async updateAssignedSupervisor(
    dto: UpdateAssignSupervisorDto,
    assignSupervisorId: string,
    organizationId: string,
  ) {
    try {
      const assignedSupervisor =
        await this.prisma.assignedSupervisor.findUnique({
          where: { id: assignSupervisorId },
        });

      if (!assignedSupervisor)
        throw new NotFoundException('Assigned Supervisor not found');

      // If service number is provided, resolve to employee ID
      let supervisorEmployeeId: string | undefined;
      if (dto.supervisorServiceNumber !== undefined) {
        // First try to resolve as a Guard
        try {
          const guardSupervisor = await this.guardService.findByServiceNumber(
            dto.supervisorServiceNumber,
            organizationId,
          );
          if (guardSupervisor) {
            // Map guard to employee ID
            const employeeId =
              await this.guardService.resolveEmployeeIdForGuard(
                guardSupervisor.id,
                organizationId,
                true,
              );
            if (!employeeId) {
              throw new NotFoundException(
                `Failed to resolve employee record for guard supervisor with service number ${dto.supervisorServiceNumber}`,
              );
            }
            supervisorEmployeeId = employeeId;
          } else {
            // If not found as guard, try as employee
            const employeeSupervisor = await this.findByServiceNumber(
              dto.supervisorServiceNumber,
              organizationId,
            );
            if (!employeeSupervisor) {
              throw new NotFoundException(
                `No supervisor found with service number ${dto.supervisorServiceNumber}`,
              );
            }
            supervisorEmployeeId = employeeSupervisor.id;
          }
        } catch (error) {
          // If guard lookup fails, try employee
          const employeeSupervisor = await this.findByServiceNumber(
            dto.supervisorServiceNumber,
            organizationId,
          );
          if (!employeeSupervisor) {
            throw new NotFoundException(
              `No supervisor found with service number ${dto.supervisorServiceNumber}`,
            );
          }
          supervisorEmployeeId = employeeSupervisor.id;
        }
      }

      // Validate location and client independently
      if (dto.locationId) {
        const location = await this.prisma.location.findUnique({
          where: {
            id: dto.locationId,
            organizationId: organizationId,
          },
        });
        if (!location)
          throw new NotFoundException(
            "Location doesn't exist for this organization",
          );
      }

      if (dto.clientId) {
        const client = await this.prisma.client.findUnique({
          where: {
            id: dto.clientId,
            organizationId: organizationId,
          },
        });
        if (!client)
          throw new NotFoundException(
            "Client doesn't exist for this organization",
          );
      }

      const updateData = {
        ...dto,
        supervisorEmployeeId: supervisorEmployeeId,
        deploymentTill: dto.deploymentTill
          ? new Date(dto.deploymentTill)
          : undefined,
      };

      // Remove serviceNumber from update data as it's not a field in AssignedSupervisor
      delete (updateData as any).supervisorServiceNumber;

      const updatedAssignSupervisor =
        await this.prisma.assignedSupervisor.update({
          where: { id: assignSupervisorId },
          data: updateData,
          include: {
            location: true,
            client: true,
            employee: true,
          },
        });

      return updatedAssignSupervisor;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Get assignments where this employee is the supervisor
   * @param supervisorEmployeeId The employee ID of the supervisor
   * @param organizationId Organization ID for security scope
   * @returns List of supervisor assignments including location and client details
   */
  async getAssignmentsBySupervisorId(
    supervisorEmployeeId: string,
    organizationId: string,
  ) {
    try {
      const assignments = await this.prisma.assignedSupervisor.findMany({
        where: {
          supervisorEmployeeId: supervisorEmployeeId,
          deploymentTill: null,
          location: {
            organizationId: organizationId,
          },
        },
        include: {
          location: {
            select: {
              id: true,
              locationName: true,
              createdLocationId: true,
            },
          },
          client: {
            select: {
              id: true,
              contractNumber: true,
              companyName: true,
            },
          },
          employee: {
            select: {
              id: true,
              serviceNumber: true,
              fullName: true,
            },
          },
        },
      });

      // Calculate working days for each assignment
      return assignments.map((assignment) => {
        let totalWorkingDays: number | null = null;
        if (assignment.deploymentDate) {
          const deploymentDate = new Date(assignment.deploymentDate);
          const deploymentTill = assignment.deploymentTill
            ? new Date(assignment.deploymentTill)
            : new Date();
          const timeDiff = deploymentTill.getTime() - deploymentDate.getTime();
          totalWorkingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        }
        return {
          ...assignment,
          totalWorkingDays,
        };
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async getAssignedSupervisorsByEmployeeId(
    employeeId: string,
    organizationId: string,
  ) {
    try {
      const assignedSupervisors = await this.prisma.assignedSupervisor.findMany(
        {
          where: {
            employeeId: employeeId,
            deploymentTill: null,
            location: {
              organizationId: organizationId,
            },
            // isActive: true
          },
          include: {
            location: {
              select: {
                id: true,
                locationName: true,
                createdLocationId: true,
              },
            },
            client: {
              select: {
                id: true,
                contractNumber: true,
                companyName: true,
              },
            },
            employee: {
              select: {
                id: true,
                serviceNumber: true,
                fullName: true,
              },
            },
            supervisor: {
              select: {
                id: true,
                serviceNumber: true,
                fullName: true,
              },
            },
          },
        },
      );

      if (!assignedSupervisors || assignedSupervisors.length === 0) return [];

      const result = assignedSupervisors.map((assignment) => {
        let totalWorkingDays: number | null = null;

        if (assignment.deploymentDate) {
          const deploymentDate = new Date(assignment.deploymentDate);
          const deploymentTill = assignment.deploymentTill
            ? new Date(assignment.deploymentTill)
            : new Date();

          const timeDiff = deploymentTill.getTime() - deploymentDate.getTime();
          totalWorkingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        }

        return {
          ...assignment,
          totalWorkingDays,
        };
      });

      return result;
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
