import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import type { CreateOrganizationDto } from './dto/create-organization.dto';

// Interface to ensure type safety for organization data
interface OrganizationData {
  id?: string;
  organizationName: string;
  province: string;
  city: string;
  phoneNumber1: string;
  phoneNumber2: string | null;
  addressLine1: string;
  addressLine2: string | null;
  email: string;
  userId: string;
  isActive: boolean;
}
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOfficeDto } from './dto/create-office-dto';
import { CreateOrganizationBankAccountDto } from './dto/create-bank-account.dto';
import { generateRandomNumber } from 'src/common/utils/random-num-generator';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  // Create Organization (no logo handling for now)
  async create(dto: CreateOrganizationDto) {
    try {
      // Validate features array
      if (!Array.isArray(dto.features) || dto.features.length === 0) {
        throw new Error('At least one feature must be provided');
      }

      // Pre-checks for duplicates - check email in users since orgs don't have email field
      const existingOrgAdmin = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          userRoles: {
            some: {
              role: {
                roleName: RolesEnum.organizationAdmin,
              },
            },
          },
        },
      });
      if (existingOrgAdmin)
        throw new ConflictException(
          'An organization admin with this email already exists',
        );

      const existingUserByEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingUserByEmail)
        throw new ConflictException('A user with this email already exists');

      const existingUserByUserName = await this.prisma.user.findFirst({
        where: { userName: dto.userName },
      });
      if (existingUserByUserName)
        throw new ConflictException('Username already exists');

      const result = await this.prisma.$transaction(
        async (tx) => {
          // Create or get all features within the transaction
          const features = await Promise.all(
            dto.features.map((featureName) =>
              tx.feature.upsert({
                where: { name: featureName },
                create: { name: featureName },
                update: {},
              }),
            ),
          );
          // Find organization admin role
          const role = await tx.role.findFirst({
            where: { roleName: RolesEnum.organizationAdmin },
          });
          if (!role)
            throw new NotFoundException(
              `Role '${RolesEnum.organizationAdmin}' not found`,
            );

          // Create user
          const hashedPassword = await bcrypt.hash(dto.password, 10);
          const newUser = await tx.user.create({
            data: {
              email: dto.email,
              password: hashedPassword,
              userName: dto.userName,
            },
          });

          // Link role
          await tx.userRole.create({
            data: { userId: newUser.id, roleId: role.id },
          });

          // Build organization data
          const orgData = {
            ...(dto.organizationId && { id: dto.organizationId }),
            organizationName: dto.organizationName,
            province: dto.province,
            city: dto.city,
            phoneNumber1: dto.phoneNumber1,
            phoneNumber2: (dto.phoneNumber2 as string) || null,
            addressLine1: dto.addressLine1,
            addressLine2: (dto.addressLine2 as string) || null,
            userId: newUser.id,
            isActive: true,
          };

          // Create organization and link pre-created features
          const organization = await tx.organization.create({
            data: {
              ...orgData,
              organizationFeatures: {
                create: features.map((feature) => ({
                  featureId: feature.id,
                })),
              },
            },
            include: {
              organizationFeatures: {
                select: {
                  feature: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          });

          // If offices are provided, create them
          if (
            dto.office &&
            Array.isArray(dto.office) &&
            dto.office.length > 0
          ) {
            for (const o of dto.office) {
              await tx.office.create({
                data: {
                  ...o,
                  organizationId: organization.id,
                  branchCode: generateRandomNumber(4),
                },
              });
            }
          }

          // Get user with roles
          const userWithRoles = await tx.user.findUnique({
            where: { id: newUser.id },
            include: { userRoles: { include: { role: true } } },
          });
          if (!userWithRoles)
            throw new NotFoundException('User not found after creation');

          // Format response
          return {
            data: {
              user: {
                id: userWithRoles.id,
                email: userWithRoles.email,
                userName: userWithRoles.userName,
                roleName:
                  userWithRoles.userRoles[0]?.role.roleName ||
                  'organizationAdmin',
                organizationId: organization.id,
                features: dto.features,
                isSuperAdmin: false,
              },
              organization: {
                id: organization.id,
                name: organization.organizationName,
                features: dto.features,
              },
            },
          };
        },
        {
          timeout: 20000, // Increase timeout to 20 seconds
          maxWait: 25000, // Maximum time to wait for transaction to start
        },
      );

      return result;
    } catch (error) {
      console.error('Organization creation error:', error);

      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;

      if (error.code) {
        handlePrismaError(error);
      }

      throw new InternalServerErrorException('Failed to create organization', {
        cause: error,
      });
    }
  }

  // Add Office
  async addOffice(dto: CreateOfficeDto, organizationId: string) {
    if (!organizationId) throw new NotFoundException('Organization ID missing');

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization doesn't exist");

    const branchCode = generateRandomNumber(4);
    return this.prisma.office.create({
      data: { ...dto, organizationId, branchCode },
      include: { organization: true },
    });
  }

  // Add Bank Account
  async addBankAccount(
    dto: CreateOrganizationBankAccountDto,
    organizationId: string,
  ) {
    if (!organizationId) throw new NotFoundException('Organization ID missing');

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) throw new NotFoundException("Organization doesn't exist");

    return this.prisma.organizationBankAccount.create({
      data: { ...dto, organizationId },
      include: { organization: true },
    });
  }

  // Get Offices
  async getOffices(organizationId: string) {
    try {
      if (!organizationId)
        throw new NotFoundException('Organization ID missing');

      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!organization)
        throw new NotFoundException(
          `Organization with ID ${organizationId} not found`,
        );

      return this.prisma.office.findMany({
        where: { organizationId },
        include: { organization: true },
      });
    } catch (error) {
      console.error('Error fetching offices:', {
        organizationId,
        error: error.message,
      });
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException(
        'Failed to fetch offices. Please try again later.',
      );
    }
  }

  // Get All Bank Accounts
  async getAllBankAccounts(organizationId: string) {
    if (!organizationId) throw new NotFoundException('Organization ID missing');
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
    if (!org)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    return org;
  }

  // Update Organization
  async update(id: string, dto: UpdateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Organization with ID ${id} not found`);

    const { office, ...rest } = dto;
    const updatedOrg = await this.prisma.organization.update({
      where: { id },
      data: rest,
    });

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
      where: { id },
    });
    if (!existing)
      throw new NotFoundException(`Organization with ID ${id} not found`);
    return this.prisma.organization.delete({ where: { id } });
  }
}
