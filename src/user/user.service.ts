import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Prisma, User } from '@prisma/client';
import { RoleService } from '../role/role.service';
import * as bcrypt from 'bcrypt';
import { CreateEmployeeUserDto } from './dto/create-employee-user.dto';
import { CreateServiceNumberUserDto } from './dto/create-service-number-user.dto';
import { PersonType } from '../common/enums/person-type.enum';
import { handlePrismaError } from '../common/utils/prisma-error-handler';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleService: RoleService,
  ) {}

  /**
   * Create a regular system user
   */
  async create(data: CreateUserDto): Promise<User> {
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

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        userName: data.userName,
        profileImage: data.profileImage,
      },
    });

    await this.prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    return user;
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
              userId: user.id,
            } as Prisma.GuardUncheckedUpdateInput
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
