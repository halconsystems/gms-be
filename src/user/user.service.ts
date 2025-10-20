import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RoleService } from '../role/role.service';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeUserDto } from './dto/create-employee-user.dto';
import { CreateServiceNumberUserDto } from './dto/create-service-number-user.dto';
import { GetSupervisorsDto } from './dto/get-supervisors.dto';
import { PersonType } from '../common/enums/person-type.enum';
import { RolesEnum } from '../common/enums/roles-enum';
import { handlePrismaError } from '../common/utils/prisma-error-handler';

// Define User type based on what we need
type User = {
  id: string;
  email: string;
  userName: string;
  password: string;
  profileImage?: string | null;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleService: RoleService,
  ) {}

  /**
   * Create a regular system user
   */
  async create(data: CreateUserDto, organizationId: string): Promise<User> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingUser) {
        throw new ConflictException('A user with this email already exists');
      }

      const role = await this.roleService.findByName(data.roleName);
      if (!role) {
        throw new NotFoundException(`Role '${data.roleName}' not found`);
      }

      // Validate office belongs to organization
      const office = await this.prisma.office.findFirst({
        where: {
          id: data.officeId,
          organizationId
        }
      });
      
      if (!office) {
        throw new NotFoundException('Office not found for this organization');
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      const result = await this.prisma.$transaction(async (prisma) => {
        // Create user
        const user = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            userName: data.userName,
            profileImage: data.profileImage,
          },
        });

        // Link user to role
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });

        // Link user to organization and office
        await prisma.userOffice.create({
          data: {
            userId: user.id,
            organizationId,
            officeId: data.officeId,
          },
        });

        return user;
      });

      return result;
    } catch (error) {
      handlePrismaError(error);
      // Add explicit return to satisfy the return type
      return undefined as unknown as User;
    }
  }

  /**
   * Create a user account for an existing employee within an organization
   */
  async createEmployeeUser(
    data: CreateEmployeeUserDto,
    organizationId: string,
  ) {
    try {
      // Check duplicate email
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('A user with this email already exists');
      }

      // Validate role
      const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        throw new NotFoundException(`Role '${data.roleId}' not found`);
      }

      // Ensure employee exists in this org
      const existingEmployee = await this.prisma.employee.findFirst({
        where: {
          id: data.employeeId,
          organizationId,
        },
      });

      if (!existingEmployee) {
        throw new NotFoundException(
          "Employee doesn't exist for this organization",
        );
      }

      // Ensure employee not already linked to a user
      if (existingEmployee.userId) {
        throw new ConflictException('This employee is already linked to a user');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user + link to role, office, and employee
      const result = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            userName: data.userName,
            profileImage: data.profileImage,
          },
        });

        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });

        // Validate office belongs to organization
        const office = await prisma.office.findFirst({
          where: {
            id: data.officeId,
            organizationId
          }
        });
        
        if (!office) {
          throw new NotFoundException('Office not found for this organization');
        }

        await prisma.userOffice.create({
          data: {
            userId: user.id,
            organizationId,
            officeId: data.officeId,
          },
        });

        const updatedEmployee = await prisma.employee.update({
          where: { id: data.employeeId },
          data: { userId: user.id },
        });

        return { user, employee: updatedEmployee };
      });

      return result;
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Fetch all users
   */
  async findAll(): Promise<User[]> {
    try {
      return this.prisma.user.findMany({
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users', {
        cause: error,
      });
    }
  }

  /**
   * Fetch single user by ID
   */
  async findOne(id: string): Promise<User> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch user', {
        cause: error,
      });
    }
  }

  /**
   * Remove user
   */
  async remove(id: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.prisma.user.delete({ where: { id } });
  }

  /**
   * Find user by email (with roles)
   */
  async findByEmail(email: string): Promise<any | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Create a user account for an employee or guard using their service number
   */
  /**
   * Get all users with supervisor roles in the organization
   * @param organizationId The organization ID to filter by
   * @param dto Optional filters for location and client
   * @returns Array of supervisors with their basic information
   */
  async getSupervisors(organizationId: string, dto?: GetSupervisorsDto) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    try {
      // First, validate the organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId }
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      // Validate location and client if provided
      if (dto?.locationId && dto?.clientId) {
        const location = await this.prisma.location.findFirst({
          where: {
            id: dto.locationId,
            clientId: dto.clientId,
            organizationId
          }
        });

        if (!location) {
          throw new NotFoundException(`Location with ID ${dto.locationId} not found for client ${dto.clientId}`);
        }
      }

      // Get users with supervisor roles
      const users = await this.prisma.user.findMany({
        where: {
          userRoles: {
            some: {
              role: {
                roleName: {
                  in: [RolesEnum.supervisor, RolesEnum.guardSupervisor]
                }
              }
            }
          }
        },
        include: {
          guard: {
            where: { 
              organizationId,
              ...(dto?.locationId && dto?.clientId ? {
                assignedGuard: {
                  some: {
                    location: {
                      id: dto.locationId,
                      clientId: dto.clientId
                    }
                  }
                }
              } : {})
            },
            select: {
              serviceNumber: true,
              fullName: true,
              id: true
            }
          },
          employee: {
            where: { 
              organizationId,
              ...(dto?.locationId && dto?.clientId ? {
                supervisorFor: {
                  some: {
                    locationId: dto.locationId,
                    clientId: dto.clientId,
                    deploymentTill: null
                  }
                }
              } : {})
            },
            select: {
              serviceNumber: true,
              fullName: true,
              id: true
            }
          }
        }
      });

      // Transform the response to handle arrays
      return users
        .map(user => {
          const guardInfo = user.guard?.[0];
          const employeeInfo = user.employee?.[0];
          const person = guardInfo || employeeInfo;
          
          if (!person) return null;

          return {
            id: user.id,
            serviceNumber: person.serviceNumber,
            fullName: person.fullName,
            personType: guardInfo ? 'guard' : 'employee'
          };
        })
        .filter(Boolean); // Filter out null values
    } catch (error) {
      // Log the error for debugging
      console.error('Error in getSupervisors:', error);
      
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      
      // Handle Prisma errors
      if (typeof handlePrismaError === 'function') {
        handlePrismaError(error);
      }
      
      throw new InternalServerErrorException('Failed to fetch supervisors', {
        cause: error
      });
    }
  }

  async createServiceNumberUser(
    data: CreateServiceNumberUserDto,
    organizationId: string,
  ) {
    try {
      // Check duplicate email
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new ConflictException('A user with this email already exists');
      }

      // Validate role
      const role = await this.prisma.role.findUnique({ where: { id: data.roleId } });
      if (!role) {
        throw new NotFoundException(`Role '${data.roleId}' not found`);
      }

      // Find person by service number and type
      let person;
      if (data.personType === PersonType.EMPLOYEE) {
        person = await this.prisma.employee.findUnique({
          where: {
            organizationId_serviceNumber: {
              organizationId,
              serviceNumber: data.serviceNumber
            }
          }
        });
        if (!person) {
          throw new NotFoundException(
            `Employee with service number ${data.serviceNumber} not found in this organization`,
          );
        }
        if (person.userId) {
          throw new ConflictException('This employee is already linked to a user');
        }
      } else {
        person = await this.prisma.guard.findUnique({
          where: {
            organizationId_serviceNumber: {
              organizationId,
              serviceNumber: data.serviceNumber
            }
          }
        });
        if (!person) {
          throw new NotFoundException(
            `Guard with service number ${data.serviceNumber} not found in this organization`,
          );
        }
        if (person.userId) {
          throw new ConflictException('This guard is already linked to a user');
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10);

      // Create user + link to role, office, and person (employee or guard)
      const result = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            userName: data.userName,
            profileImage: data.profileImage,
          },
        });

        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: role.id,
          },
        });

        // Validate office belongs to organization
        const office = await prisma.office.findFirst({
          where: {
            id: data.officeId,
            organizationId
          }
        });
        
        if (!office) {
          throw new NotFoundException('Office not found for this organization');
        }

        await prisma.userOffice.create({
          data: {
            userId: user.id,
            organizationId,
            officeId: data.officeId,
          },
        });

        let updatedPerson;
        if (data.personType === PersonType.EMPLOYEE) {
          updatedPerson = await prisma.employee.update({
            where: { id: person.id },
            data: { userId: user.id },
          });
        } else {
            updatedPerson = await prisma.guard.update({
            where: { id: person.id },
            data: {
              userId: user.id
            }
          });
        }

        return { user, person: updatedPerson };
      });

      return result;
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
