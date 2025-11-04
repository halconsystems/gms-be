import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { ForbiddenException } from '@nestjs/common';
import { shouldFilterByOffice, getSupervisorLocationFilter } from 'src/common/utils/office-filter';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { generateRandomNumber } from 'src/common/utils/random-num-generator';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine if we should filter data by office for the given user.
   * Only managers are restricted to their officeId. If a manager lacks an officeId,
   * throws ForbiddenException.
   * @throws {ForbiddenException} When manager has no office assigned
   * @returns Object indicating if results should be filtered and by which officeId
   */
  // Office filtering delegated to shared helper `shouldFilterByOffice`

  async create(dto: CreateLocationDto, organizationId: string) {
    try {
      const generatedId: number = generateRandomNumber(5);

      const location = await this.prisma.location.findFirst({
        where: {
          organizationId: organizationId,
          locationName: dto.locationName,
        },
      });
      if (location)
        throw new ConflictException('Given location name already exists');

      return await this.prisma.location.create({
        data: {
          organizationId: organizationId,
          clientId: dto.clientId,
          locationName: dto.locationName,
          createdLocationId: generatedId.toString(),
          address: dto.address,
          city: dto.city,
          provinceState: dto.provinceState,
          country: dto.country,
          GPScoordinate: dto.GPScoordinate,
          locationTypeId: dto.locationTypeId,
          authorizedPersonName: dto.authorizedPersonName,
          authorizedPersonNumber: dto.authorizedPersonNumber,
          authorizedPersonDesignation: dto.authorizedPersonDesignation,
          taxes: {
            create: dto.taxes.map((tax) => ({
              addInvoice: tax.addInvoice,
              amount: tax.amount,
              percentage: tax.percentage,
              taxType: tax.taxType,
            })),
          },
          requestedGuards: {
            create: dto.requestedGuards.map((guard) => ({
              guardCategoryId: guard.guardCategoryId,
              shiftId: guard.shiftId,
              quantity: guard.quantity,
              gazettedHoliday: guard.gazettedHoliday,
              chargesPerMonth: guard.chargesPerMonth,
              overtimePerHour: guard.overtimePerHour,
              allowance: guard.allowance,
              finances: {
                create: {
                  gazettedHoliday: guard.finances.gazettedHoliday,
                  salaryPerMonth: guard.finances.salaryPerMonth,
                  overtimePerHour: guard.finances.overtimePerHour,
                  allowance: guard.finances.allowance,
                },
              },
            })),
          },
        },
        include: {
          requestedGuards: {
            include: {
              finances: true,
            },
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findAll() {
    return this.prisma.location.findMany({
      include: {
        requestedGuards: {
          include: {
            finances: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user?: any) {
    const filter = shouldFilterByOffice(user);
    const where: any = { id };
    if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

    // Use findUnique only when we are querying by id alone (no office filter).
    const location = filter.shouldFilter && filter.officeId
      ? await this.prisma.location.findFirst({ where, include: { requestedGuards: { include: { finances: true } } } })
      : await this.prisma.location.findUnique({ where: { id }, include: { requestedGuards: { include: { finances: true } } } });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location;
  }

  async findByOrganizationId(organizationId: string, user?: any) {
    const filter = shouldFilterByOffice(user);
    const where: any = {
      organizationId: organizationId,
      // Include all locations in the organization
      isActive: true, // Only include active locations
    };
    if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

    const location = await this.prisma.location.findMany({
      where,
      include: {
        assignedGuard: {
          where: {
            // Only include currently deployed guards (no end date)
            deploymentTill: null,
          },
          select: {
            deploymentDate: true,
            deploymentTill: true,
            guardCategory: {
              select: {
                categoryName: true,
              },
            },
            guard: {
              select: {
                id: true,
                fullName: true,
                serviceNumber: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            contractNumber: true,
            companyName: true,
            contactNumber: true,
            industry: true,
            address: true,
            city: true,
            state: true,
          },
        },
        requestedGuards: {
          include: {
            guardCategory: {
              select: { categoryName: true },
            },
            finances: true,
          },
        },
      },
    });

    return location;
  }

  async findByClientId(clientId: string, organizationId: string, user?: any) {
    const filter = shouldFilterByOffice(user);
    const where: any = {
      clientId: clientId,
      organizationId: organizationId,
    };
    if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

    const location = await this.prisma.location.findMany({
      where,
      include: {
        assignedGuard: true,
        requestedGuards: {
          include: {
            finances: true,
          },
        },
      },
    });

    return location;
  }

  async findAssignedGuardByLocation(
    locationId: string,
    organizationId: string,
    user?: any,
  ) {
    const filter = shouldFilterByOffice(user);
    const whereLoc: any = { id: locationId };
    if (filter.shouldFilter && filter.officeId) whereLoc.officeId = filter.officeId;

    // Supervisor location-based restriction
    const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
    if (locationFilter.shouldFilter) {
      if (!locationFilter.locationIds || !locationFilter.locationIds.includes(locationId)) {
        throw new ForbiddenException('Supervisor can only view guards at their assigned locations');
      }
    }

    // Use findFirst to allow combined filters (id + officeId) without Prisma runtime errors
    const location = await this.prisma.location.findFirst({
      where: whereLoc,
      select: {
        assignedGuard: {
          where: {
            // Only get currently assigned guards (no end date)
            deploymentTill: null,
          },
          select: {
            id: true,
            requestedGuard: {
              select: {
                Shift: true,
              },
            },
            deploymentDate: true,
            deploymentTill: true,
            guardCategory: {
              select: {
                categoryName: true,
              },
            },
            guard: true,
          },
        },
      },
    });

    const assignedGuards = location?.assignedGuard ?? [];

    const enriched = assignedGuards.map((ag) => {
      const deploymentDate = new Date(ag.deploymentDate);
      const deploymentTill = ag.deploymentTill
        ? new Date(ag.deploymentTill)
        : new Date();

      const timeDiff = deploymentTill.getTime() - deploymentDate.getTime();
      const totalWorkingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      return {
        ...ag,
        totalWorkingDays,
      };
    });

    return enriched;
  }

  async update(
    id: string,
    dto: Partial<CreateLocationDto>,
    organizationId: string,
  ) {
    try {
      const updateData: any = {
        ...(dto.clientId && { clientId: dto.clientId }),
        ...(dto.locationName && { locationName: dto.locationName }),
        ...(dto.createdLocationId && {
          createdLocationId: dto.createdLocationId,
        }),
        ...(dto.address && { address: dto.address }),
        ...(dto.city && { city: dto.city }),
        ...(dto.provinceState && { provinceState: dto.provinceState }),
        ...(dto.country && { country: dto.country }),
        ...(dto.GPScoordinate && { GPScoordinate: dto.GPScoordinate }),
        ...(dto.locationTypeId && { locationTypeId: dto.locationTypeId }),
        ...(dto.authorizedPersonName && {
          authorizedPersonName: dto.authorizedPersonName,
        }),
        ...(dto.authorizedPersonNumber && {
          authorizedPersonNumber: dto.authorizedPersonNumber,
        }),
        ...(dto.authorizedPersonDesignation && {
          authorizedPersonDesignation: dto.authorizedPersonDesignation,
        }),
      };

      if (dto.taxes) {
        updateData.taxes = {
          deleteMany: {},
          create: dto.taxes.map((tax) => ({
            addInvoice: tax.addInvoice,
            amount: tax.amount,
            percentage: tax.percentage,
            taxType: tax.taxType,
          })),
        };
      }

      if (dto.requestedGuards) {
        updateData.requestedGuards = {
          deleteMany: {},
          create: dto.requestedGuards.map((guard) => ({
            guardCategoryId: guard.guardCategoryId,
            shiftId: guard.shiftId,
            quantity: guard.quantity,
            gazettedHoliday: guard.gazettedHoliday,
            chargesPerMonth: guard.chargesPerMonth,
            overtimePerHour: guard.overtimePerHour,
            allowance: guard.allowance,
            finances: {
              create: {
                gazettedHoliday: guard.finances.gazettedHoliday,
                salaryPerMonth: guard.finances.salaryPerMonth,
                overtimePerHour: guard.finances.overtimePerHour,
                allowance: guard.finances.allowance,
              },
            },
          })),
        };
      }

      return await this.prisma.location.update({
        where: {
          id,
          organizationId,
        },
        data: updateData,
        include: {
          requestedGuards: {
            include: {
              finances: true,
            },
          },
        },
      });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async remove(id: string) {
    try {
      // First delete RequestedGuardFinance → RequestedGuard → Location

      const requestedGuards = await this.prisma.requestedGuard.findMany({
        where: { locationId: id },
        select: { id: true },
      });

      const guardIds = requestedGuards.map((g) => g.id);

      await this.prisma.requestedGuardFinance.deleteMany({
        where: { requestedGuardId: { in: guardIds } },
      });

      await this.prisma.requestedGuard.deleteMany({
        where: { locationId: id },
      });

      await this.prisma.location.delete({
        where: { id },
      });

      return await this.prisma.location.delete({ where: { id } });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async getRequestedGuardsByLocationId(locationId: string, user?: any) {
    try {
      // Supervisor location-based restriction
      const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
      if (locationFilter.shouldFilter) {
        if (!locationFilter.locationIds || !locationFilter.locationIds.includes(locationId)) {
          throw new ForbiddenException('Supervisor can only view requested guards for their assigned locations');
        }
      }

      const requestedGuards = await this.prisma.requestedGuard.findMany({
        where: { locationId: locationId },
        include: {
          guardCategory: {
            select: {
              id: true,
              categoryName: true,
            },
          },
        },
      });

      // Calculate total requested guards count
      const totalCount = requestedGuards.reduce((sum, guard) => sum + guard.quantity, 0);

      return { count: totalCount, requestedGuards };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  /**
   * Calculates the total number of guards requested across all active locations in the organization.
   * Respects office and supervisor filtering based on user role.
   * @param organizationId - The organization ID to calculate totals for
   * @param user - The user making the request, used for access control
   * @returns Object containing the total count of requested guards
   */
  async getTotalRequestedGuardsByOrganization(organizationId: string, user?: any) {
    try {
      const filter = shouldFilterByOffice(user);
      let where: any = {
        location: { 
          organizationId, 
          isActive: true 
        }
      };

      // Apply office filtering if needed
      if (filter.shouldFilter && filter.officeId) {
        where.location.officeId = filter.officeId;
      }

      // Apply supervisor location filtering
      const locationFilter = await getSupervisorLocationFilter(user, this.prisma);
      if (locationFilter.shouldFilter) {
        if (!locationFilter.locationIds?.length) {
          return { count: 0 }; // Return 0 if supervisor has no assigned locations
        }
        where.locationId = { in: locationFilter.locationIds };
      }

      // Use Prisma aggregate to sum quantities
      const result = await this.prisma.requestedGuard.aggregate({
        where,
        _sum: {
          quantity: true
        }
      });

      return { count: result._sum.quantity || 0 };
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async findLocationsBySupervisorId(
    supervisorEmployeeId: string,
    organizationId: string,
    user?: any,
  ) {
    try {
  const filter = shouldFilterByOffice(user);
      const where: any = {
        organizationId,
        assignedSupervisor: {
          some: {
            supervisorEmployeeId,
            deploymentTill: null,
          },
        },
      };
      if (filter.shouldFilter && filter.officeId) where.officeId = filter.officeId;

      const locations = await this.prisma.location.findMany({
        where,
        select: {
          id: true,
          createdLocationId: true,
          locationName: true,
          address: true,
          city: true,
          provinceState: true,
          country: true,
          GPScoordinate: true,
          authorizedPersonName: true,
          authorizedPersonNumber: true,
          authorizedPersonDesignation: true,
          isActive: true,
          client: {
            select: {
              companyName: true,
              contractNumber: true,
              contactNumber: true,
            },
          },
          assignedGuard: {
            where: {
              deploymentTill: null, // Only currently assigned guards
            },
            select: {
              id: true,
              deploymentDate: true,
              guard: {
                select: {
                  id: true,
                  fullName: true,
                  serviceNumber: true,
                  contactNumber: true,
                },
              },
              guardCategory: {
                select: {
                  categoryName: true,
                },
              },
            },
          },
        },
      });

      // Transform the data to add guard count and format it
      return locations.map((location) => ({
        id: location.id,
        locationName: location.locationName,
        address: location.address,
        city: location.city,
        provinceState: location.provinceState,
        country: location.country,
        GPScoordinate: location.GPScoordinate,
        authorizedPerson: {
          name: location.authorizedPersonName,
          number: location.authorizedPersonNumber,
          designation: location.authorizedPersonDesignation,
        },
        client: {
          companyName: location.client.companyName,
          contractNumber: location.client.contractNumber,
          contactNumber: location.client.contactNumber,
        },
        guards: {
          totalCount: location.assignedGuard.length,
          list: location.assignedGuard.map((ag) => ({
            id: ag.id,
            guardId: ag.guard.id,
            name: ag.guard.fullName,
            serviceNumber: ag.guard.serviceNumber,
            contactNumber: ag.guard.contactNumber,
            category: ag.guardCategory.categoryName,
            deploymentDate: ag.deploymentDate,
          })),
        },
        isActive: location.isActive,
        createdLocationId: location.createdLocationId || location.id,
      }));
    } catch (error) {
      handlePrismaError(error);
    }
  }
}
