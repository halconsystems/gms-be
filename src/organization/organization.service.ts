import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOfficeDto } from './dto/create-office-dto';
import { CreateOrganizationBankAccountDto } from './dto/create-bank-account.dto';
import { generateRandomNumber } from 'src/common/utils/random-num-generator';
import { RolesEnum } from 'src/common/enums/roles-enum';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  // Create Organization (no logo handling for now)
  async create(dto: CreateOrganizationDto) {
    try {
      // Basic pre-checks to return friendlier errors early
      const existingOrgEmail = await this.prisma.organization.findUnique({ where: { email: dto.email } });
      if (existingOrgEmail) {
        throw new ConflictException('Organization with this email already exists');
      }

      const existingUserByEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingUserByEmail) {
        throw new ConflictException('A user with this email already exists');
      }

  const existingUserByUserName = await this.prisma.user.findFirst({ where: { userName: dto.userName } });
      if (existingUserByUserName) {
        throw new ConflictException('Username already exists');
      }

      const result = await this.prisma.$transaction(async (prisma) => {
        // Find organization admin role
        const role = await prisma.role.findFirst({ where: { roleName: RolesEnum.organizationAdmin } });
        if (!role) {
          throw new NotFoundException(`Role '${RolesEnum.organizationAdmin}' not found`);
        }

        // Hash password and create user within the transaction
        const hashedPassword = await bcrypt.hash(dto.password, 10);
        const user = await prisma.user.create({
          data: {
            email: dto.email,
            password: hashedPassword,
            userName: dto.userName,
          },
        });

        // Link role to the user
        await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

        // Build organization data (no logo for now)
        const orgData: any = {
          organizationName: dto.organizationName,
          province: dto.province,
          city: dto.city,
          phoneNumber1: dto.phoneNumber1,
          phoneNumber2: dto.phoneNumber2 || null,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2 || null,
          email: dto.email,
          userId: user.id,
          isActive: true,
        };

        if (dto.organizationId) {
          orgData.id = dto.organizationId;
        }

        const organization = await prisma.organization.create({
          data: orgData,
          include: {
            user: {
              select: { id: true, email: true, userName: true, createdAt: true, isActive: true },
            },
          },
        });

        // If offices are provided, create them
        if (dto.office && Array.isArray(dto.office) && dto.office.length > 0) {
          for (const o of dto.office) {
            await prisma.office.create({
              data: {
                ...o,
                organizationId: organization.id,
                branchCode: generateRandomNumber(4),
              },
            });
          }
        }

        return { success: true, data: organization, message: 'Organization created successfully' };
      });

      return result;
    } catch (error) {
      console.error('Organization creation error:', error);

      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }

      // Prisma unique constraint
      if ((error as any)?.code === 'P2002') {
        const field = (error as any).meta?.target?.[0] || 'unknown field';
        throw new ConflictException(`${field} already exists`);
      }

      throw new InternalServerErrorException(error.message || 'Failed to create organization');
    }
  }

  // Add Office
  async addOffice(dto: CreateOfficeDto, organizationId: string) {
    if (!organizationId) {
      throw new NotFoundException('Organization ID missing');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!org) {
      throw new NotFoundException("Organization doesn't exist");
    }

    const branchCode = generateRandomNumber(4);
    return this.prisma.office.create({
      data: { ...dto, organizationId, branchCode },
      include: { organization: true },
    });
  }

  // Add Bank Account
  async addBankAccount(dto: CreateOrganizationBankAccountDto, organizationId: string) {
    if (!organizationId) {
      throw new NotFoundException('Organization ID missing');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    
    if (!org) {
      throw new NotFoundException("Organization doesn't exist");
    }

    return this.prisma.organizationBankAccount.create({
      data: { ...dto, organizationId },
      include: { organization: true },
    });
  }

  // Get Offices
  async getOffices(organizationId: string) {
    try {
      if (!organizationId) {
        throw new NotFoundException('Organization ID missing');
      }

      // First verify the organization exists
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new NotFoundException(`Organization with ID ${organizationId} not found`);
      }

      const offices = await this.prisma.office.findMany({
        where: { organizationId },
        include: { organization: true },
      });

      return offices;
    } catch (error) {
      console.error('Error fetching offices:', {
        organizationId,
        error: error.message,
      });

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to fetch offices. Please try again later.'
      );
    }
  }

  // Get All Bank Accounts
  async getAllBankAccounts(organizationId: string) {
    if (!organizationId) {
      throw new NotFoundException('Organization ID missing');
    }

    return this.prisma.organizationBankAccount.findMany({
      where: { organizationId },
    });
  }

  // Delete Office
  async deleteOffice(officeId: string, organizationId: string) {
    const office = await this.prisma.office.findUnique({
      where: { id: officeId },
    });
    if (!office || office.organizationId !== organizationId)
      throw new NotFoundException("Office with this ID doesn't exist");

    return this.prisma.office.delete({ where: { id: officeId } });
  }

  // Get All Organizations
  async findAll() {
    return this.prisma.organization.findMany({
      include: { user: true, employee: true },
    });
  }

  // Get Organization by ID
  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { user: true, employee: true },
    });
    
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    
    return org;
  }

  // Update Organization
  async update(id: string, dto: UpdateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing)
      throw new NotFoundException(`Organization with ID ${id} not found`);

    const { office, ...rest } = dto;
    const updatedOrg = await this.prisma.organization.update({
      where: { id },
      data: rest,
    });

    // Only add new offices if provided, and avoid duplicates
    if (office && Array.isArray(office) && office.length > 0) {
      for (const o of office) {
        await this.prisma.office.create({
          data: {
            ...o,
            organization: { connect: { id } },
            branchCode: generateRandomNumber(4),
          },
        });
      }
    }

    return updatedOrg;
  }

  // Delete Organization
  async remove(id: string) {
    const existing = await this.prisma.organization.findUnique({ 
      where: { id } 
    });
    
    if (!existing) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }

    return this.prisma.organization.delete({ where: { id } });
  }
}
