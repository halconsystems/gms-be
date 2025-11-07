import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { shouldFilterByOffice } from 'src/common/utils/office-filter';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { startOfMonth, endOfMonth, parseISO, isValid } from 'date-fns';

@Injectable()
export class ClientService {
  private readonly logger = new Logger(ClientService.name);
  constructor(private readonly prisma: PrismaService) {}

  async getClientIdByUserId(userId: string): Promise<string> {
    const client = await this.prisma.client.findFirst({
      where: { userId }
    });

    if (!client) {
      throw new NotFoundException('No client record found for this user');
    }

    return client.id;
  }


  async create(data: CreateClientDto, organizationId: string) {
    try {
      console.log('Creating client with data:', { ...data, organizationId });

      // Check for existing email first
      const existingUser = await this.prisma.client.findUnique({
        where: { officialEmail: data.officialEmail },
      });
      if (existingUser) {
        throw new ConflictException('A client with this email already exists');
      }

      // Handle contract number

      let finalContractNumber: number;
      if (!data.contractNumber || data.contractNumber.trim() === '') {
        console.log('Generating auto contract number');
        // Auto-generate contract number
        const lastClient = await this.prisma.client.findFirst({
          where: { organizationId },
          orderBy: { contractNumber: 'desc' },
        });
        finalContractNumber = lastClient
          ? Number(lastClient.contractNumber) + 1
          : 1;
        console.log(
          'Generated contract number:',
          finalContractNumber.toString(),
        );
      } else {
        console.log(
          'Validating provided contract number:',
          data.contractNumber,
        );
        try {
          // Validate contract number format and length
          if (!/^\d{1,15}$/.test(data.contractNumber)) {
            throw new ConflictException('Contract number must be 1-15 digits');
          }
          finalContractNumber = Number(data.contractNumber);
          if (isNaN(finalContractNumber)) {
            throw new ConflictException(
              'Contract number is not a valid number',
            );
          }
          // Check if contract number already exists
          const existingContract = await this.prisma.client.findFirst({
            where: {
              contractNumber: finalContractNumber,
              organizationId,
            },
          });
          if (existingContract) {
            throw new ConflictException(
              'This contract number is already in use',
            );
          }

          // Additional validation for reasonable limits
          if (finalContractNumber <= 0) {
            throw new ConflictException('Contract number must be positive');
          }
        } catch (error) {
          console.error('Contract number validation error:', error);
          if (error instanceof ConflictException) {
            throw error;
          }
          throw new ConflictException('Invalid contract number format');
        }
      }

      // Remove contractNumber from data to avoid duplication
      const { contractNumber: _, ...clientData } = data;

      // Prepare final data
      const createData = {
        ...clientData,
        contractNumber: finalContractNumber,
        organizationId,
      };

      console.log('Final create data:', createData);

      // Create client with validated data
      const result = await this.prisma.client.create({
        data: createData,
        include: {
          organization: true,
        },
      });

      console.log('Client created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('Error creating client:', error);

      if (error instanceof ConflictException) {
        throw error;
      }

      // Log the full error for debugging
      console.error('Detailed error:', JSON.stringify(error, null, 2));

      if (error.code) {
        handlePrismaError(error);
      }

      throw new InternalServerErrorException('Failed to create client', error.message);
    }
  }

  async findAll() {
    const clients = await this.prisma.client.findMany({
      include: {
        organization: true,
        user: true,
      },
    });

    // Convert BigInt to string for serialization
    return clients.map((client) => ({
      ...client,
      contractNumber: client.contractNumber.toString(),
    }));
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        organization: true,
        user: true,
        location: {
          include: {
            assignedGuard: {
              where: {
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
                guard: {},
              },
            },
          },
        },
      },
    });

    if (!client) return null;

    // Convert BigInt to string for serialization
    return {
      ...client,
      contractNumber: client.contractNumber.toString(),
    };
  }

  async findClientByOrganizationId(organizationId: string, user?: any) {
  const filter = shouldFilterByOffice(user);

    const where: any = { 
      organizationId: organizationId,
    };

    // Filter clients by location.officeId for managers
    if (filter.shouldFilter) {
      // At this point we know officeId exists because shouldFilterByOffice would have thrown
      where.location = {
        some: { 
          officeId: filter.officeId 
        }
      };
    }

    const clients = await this.prisma.client.findMany({
      where,
      include: {
        organization: true,
        location: true,
        user: true,
      },
    });

    // Convert BigInt to string for serialization
    return clients.map((client) => ({
      ...client,
      contractNumber: client.contractNumber.toString(),
    }));
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    try {
      const { contractNumber, ...restData } = updateClientDto;

      let parsedContractNumber: number | undefined;
      if (contractNumber) {
        if (!/^\d+$/.test(contractNumber)) {
          throw new ConflictException(
            'Contract number must contain only digits',
          );
        }
        parsedContractNumber = Number(contractNumber);
        if (isNaN(parsedContractNumber)) {
          throw new ConflictException('Contract number is not a valid number');
        }
      }

      return await this.prisma.client.update({
        where: { id },
        data: {
          ...restData,
          ...(parsedContractNumber !== undefined
            ? { contractNumber: parsedContractNumber }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      handlePrismaError(error);
    }
  }

  async remove(id: string) {
    try {
      const isExist = await this.prisma.client.findFirst({ where: { id } });
      if (!isExist) {
        throw new NotFoundException("client doesn't exist");
      }
      return this.prisma.client.delete({ where: { id } });
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async searchClients(query: string, organizationId: string, user?: any) {
    try {
      const searchTerm = query?.trim() || '';
      if (!searchTerm) {
        return [];
      }

      this.logger.log(`Searching clients with term: ${searchTerm}`);

      const filter = shouldFilterByOffice(user);
      const MAX_RESULTS = 20;

      const where: any = {
        organizationId,
        OR: [
          { companyName: { contains: searchTerm, mode: 'insensitive' } },
          { officialEmail: { contains: searchTerm, mode: 'insensitive' } }
        ]
      };

      // Add office filtering for managers
      if (filter.shouldFilter) {
        where.location = {
          some: { officeId: filter.officeId }
        };
      }

      const clients = await this.prisma.client.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          officialEmail: true,
          contractNumber: true
        },
        orderBy: {
          companyName: 'asc'
        },
        take: MAX_RESULTS
      });

      return clients.map(client => ({
        ...client,
        contractNumber: client.contractNumber.toString()
      }));
    } catch (error) {
      this.logger.error('Failed to search clients', error);
      throw new InternalServerErrorException(`Failed to search clients: ${error.message}`, { cause: error });
    }
  }

  async getClientSummary(clientId: string) {
    try {
      const client = await this.prisma.client.findUnique({ 
        where: { id: clientId } 
      });

      if (!client) {
        throw new NotFoundException('Client not found');
      }

      const locationsCount = await this.prisma.location.count({ 
        where: { clientId } 
      });

      const assignedGuardsCount = await this.prisma.assignedGuard.count({
        where: {
          location: { clientId },
          deploymentTill: null
        }
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const attendanceRecords = await this.prisma.guardsAttendance.findMany({
        where: {
          location: { clientId },
          date: { gte: thirtyDaysAgo }
        },
        select: { type: true }
      });

      const presentCount = attendanceRecords.filter(r => r.type === 'P').length;
      const attendanceRate = attendanceRecords.length > 0 
        ? (presentCount / attendanceRecords.length) * 100 
        : 0;

      return {
        clientId,
        clientName: client.companyName,
        totalLocations: locationsCount,
        totalAssignedGuards: assignedGuardsCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        period: 'Last 30 days'
      };
    } catch (error) {
      this.logger.error('Failed to fetch client summary', error);
      throw new InternalServerErrorException('Failed to fetch client summary');
    }
  }

  async getAssignedGuards(clientId: string, locationId?: string, page: number = 1, limit: number = 20) {
    try {
      const where: any = {
        location: { clientId },
        deploymentTill: null
      };

      if (locationId) {
        where.locationId = locationId;
      }

      // Ensure valid pagination values
      page = Math.max(1, Number(page) || 1);
      limit = Math.min(100, Math.max(1, Number(limit) || 20));

      const total = await this.prisma.assignedGuard.count({ where });
      const skip = (page - 1) * limit;

      const assignedGuards = await this.prisma.assignedGuard.findMany({
        where,
        skip,
        take: limit,
        include: {
          guard: {
            select: {
              id: true,
              fullName: true,
              serviceNumber: true,
              contactNumber: true,
              cnicNumber: true
            }
          },
          location: {
            select: {
              id: true,
              locationName: true,
              address: true,
              city: true
            }
          },
          guardCategory: {
            select: {
              categoryName: true
            }
          }
        },
        orderBy: { deploymentDate: 'desc' }
      });

      const guards = assignedGuards.map(ag => ({
        id: ag.id,
        guardId: ag.guard.id,
        guardName: ag.guard.fullName,
        serviceNumber: ag.guard.serviceNumber,
        contactNumber: ag.guard.contactNumber,
        cnicNumber: ag.guard.cnicNumber,
        locationId: ag.location.id,
        locationName: ag.location.locationName,
        locationAddress: ag.location.address,
        locationCity: ag.location.city,
        category: ag.guardCategory?.categoryName || 'Uncategorized',
        deploymentDate: ag.deploymentDate,
        status: 'Active'
      }));

      return {
        data: guards,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch assigned guards', error);
      throw new InternalServerErrorException('Failed to fetch assigned guards');
    }
  }

  async getClientLocations(clientId: string) {
    // Validate UUID format (version-agnostic)
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(clientId)) {
      throw new BadRequestException('Invalid client ID format');
    }

    try {
      // Check if client exists
      const client = await this.prisma.client.findUnique({
        where: { id: clientId }
      });

      if (!client) {
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      }

      const locations = await this.prisma.location.findMany({
        where: {
          clientId,
          isActive: true
        },
        include: {
          assignedGuard: {
            where: {
              deploymentTill: null
            },
            select: {
              id: true,
              guard: {
                select: {
                  fullName: true,
                  serviceNumber: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const locationsWithStats = locations.map(loc => ({
        id: loc.id,
        locationName: loc.locationName || '',
        address: loc.address || '',
        city: loc.city || '',
        provinceState: loc.provinceState || '',
        country: loc.country || '',
        createdLocationId: loc.createdLocationId || null,
        authorizedPersonName: loc.authorizedPersonName || '',
        authorizedPersonNumber: loc.authorizedPersonNumber || '',
        assignedGuardsCount: loc.assignedGuard.length,
        assignedGuards: loc.assignedGuard.map(ag => ({
          guardName: ag.guard?.fullName || 'Unknown',
          serviceNumber: ag.guard?.serviceNumber || 'N/A'
        })).filter(guard => guard.guardName !== 'Unknown' || guard.serviceNumber !== 'N/A'),
        status: 'Active', // Since we're filtering by isActive: true, all locations are active
        createdAt: loc.createdAt
      }));

      return {
        data: locationsWithStats,
        total: locationsWithStats.length
      };
    } catch (error) {
      // Detailed error logging
      this.logger.error('Error in getClientLocations:', {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          meta: error.meta,
        },
        clientId,
        stack: error.stack
      });

      // Development-only detailed logging
      if (process.env.NODE_ENV === 'development') {
        console.error('Detailed error in getClientLocations:', {
          error,
          clientId,
          stack: error.stack
        });
      }

      // Handle known error types
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle Prisma specific errors
      if (error.code) {
        switch (error.code) {
          case 'P2025':
            throw new NotFoundException(`Client with ID ${clientId} not found`);
          case 'P2003':
            this.logger.error('Foreign key constraint failed:', error);
            throw new BadRequestException('Invalid relationship in request');
          default:
            this.logger.error(`Unhandled Prisma error code: ${error.code}`, error);
            throw new InternalServerErrorException('Database operation failed');
        }
      }

      throw new InternalServerErrorException('Failed to fetch client locations');
    }
  }

  async getClientAttendance(
    clientId: string,
    dateFrom?: string,
    dateTo?: string,
    locationId?: string,
    page: number = 1,
    limit: number = 50
  ) {
    try {
      // Validate and parse dates
      const fromDate = dateFrom ? parseISO(dateFrom) : startOfMonth(new Date());
      const toDate = dateTo ? parseISO(dateTo) : endOfMonth(new Date());

      // Validate date formats
      if (!isValid(fromDate) || !isValid(toDate)) {
        throw new BadRequestException('Invalid date format, expected YYYY-MM-DD');
      }

      // Validate date range
      if (fromDate > toDate) {
        throw new BadRequestException('Invalid date range');
      }

      const where: any = {
        location: { clientId },
        date: { gte: fromDate, lte: toDate }
      };

      if (locationId) {
        where.locationId = locationId;
      }

      // Ensure valid pagination values
      page = Math.max(1, Number(page) || 1);
      limit = Math.min(100, Math.max(1, Number(limit) || 50));
      
      const total = await this.prisma.guardsAttendance.count({ where });
      const skip = (page - 1) * limit;

      const attendanceRecords = await this.prisma.guardsAttendance.findMany({
        where,
        skip,
        take: limit,
        include: {
          guard: {
            select: {
              id: true,
              fullName: true,
              serviceNumber: true
            }
          },
          location: {
            select: {
              id: true,
              locationName: true,
              city: true
            }
          },
          shift: {
            select: {
              shiftName: true
            }
          }
        },
        orderBy: { date: 'desc' }
      });

      // Use groupBy for efficient statistics calculation
      const attendanceStats = await this.prisma.guardsAttendance.groupBy({
        by: ['type'],
        where,
        _count: true
      });

      const stats = {
        present: 0,
        absent: 0,
        relieved: 0,
        leave: 0
      };

      let totalRecords = 0;
      attendanceStats.forEach(stat => {
        const count = stat._count;
        if (stat.type === 'P') stats.present = count;
        else if (stat.type === 'A') stats.absent = count;
        else if (stat.type === 'R') stats.relieved = count;
        else if (stat.type === 'L') stats.leave = count;
        totalRecords += count;
      });

      const attendanceRate = totalRecords > 0 
        ? (stats.present / totalRecords) * 100 
        : 0;

      const attendance = attendanceRecords.map(ar => ({
        id: ar.id,
        date: ar.date,
        type: ar.type,
        overtime: ar.overtime,
        isHoliday: ar.isHoliday,
        guardId: ar.guard.id,
        guardName: ar.guard.fullName,
        serviceNumber: ar.guard.serviceNumber,
        locationId: ar.location.id,
        locationName: ar.location.locationName,
        locationCity: ar.location.city,
        shiftName: ar.shift.shiftName
      }));

      return {
        data: attendance,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        },
        dateRange: {
          from: fromDate,
          to: toDate
        },
        statistics: {
          ...stats,
          total: totalRecords,
          attendanceRate: Math.round(attendanceRate * 100) / 100
        }
      };
    } catch (error) {
      this.logger.error('Failed to fetch client attendance data', error);
      throw new InternalServerErrorException('Failed to fetch client attendance data');
    }
  }
}
