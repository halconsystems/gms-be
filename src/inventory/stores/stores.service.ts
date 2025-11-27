import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { GetStoreDto } from './dto/get-store.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

/**
 * Stores Service
 * Handles CRUD operations for inventory stores (warehouse locations)
 * Multi-tenant support with organizationId filtering
 */
@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new store
   */
  async create(
    dto: CreateStoreDto,
    organizationId: string,
  ): Promise<any> {
    try {
      // Validate that officeId belongs to the organization
      const office = await this.prisma.office.findFirst({
        where: {
          id: dto.officeId,
          organizationId,
        },
      });

      if (!office) {
        throw new BadRequestException(
          'Office not found or does not belong to this organization',
        );
      }

      const store = await this.prisma.store.create({
        data: {
          organizationId,
          officeId: dto.officeId,
          name: dto.name,
          location: dto.location,
          address: dto.address,
          phone: dto.phone,
          email: dto.email,
          manager: dto.manager,
          capacity: dto.capacity,
          isActive: true,
        },
        include: {
          office: true,
          organization: true,
        },
      });

      return store;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Get all stores for an organization with pagination
   */
  async findAll(
    organizationId: string,
    dto: GetStoreDto,
  ): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = {
        organizationId,
      };

      if (dto.officeId) {
        where.officeId = dto.officeId;
      }

      if (dto.isActive !== undefined) {
        where.isActive = dto.isActive;
      }

      if (dto.search) {
        where.OR = [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { location: { contains: dto.search, mode: 'insensitive' } },
          { manager: { contains: dto.search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.store.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            office: true,
          },
        }),
        this.prisma.store.count({ where }),
      ]);

      return {
        data,
        total,
        page: dto.page || 1,
        limit: dto.limit || 10,
        totalPages: Math.ceil(total / (dto.limit || 10)),
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Get a single store by ID
   */
  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const store = await this.prisma.store.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          office: true,
          organization: true,
          inventory: {
            include: {
              item: true,
            },
          },
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      return store;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Update a store
   */
  async update(
    id: string,
    dto: UpdateStoreDto,
    organizationId: string,
  ): Promise<any> {
    try {
      // Verify store exists
      const store = await this.prisma.store.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      // Validate officeId if provided
      if (dto.officeId) {
        const office = await this.prisma.office.findFirst({
          where: {
            id: dto.officeId,
            organizationId,
          },
        });

        if (!office) {
          throw new BadRequestException(
            'Office not found or does not belong to this organization',
          );
        }
      }

      const updated = await this.prisma.store.update({
        where: { id },
        data: {
          ...dto,
        },
        include: {
          office: true,
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Delete a store
   */
  async remove(id: string, organizationId: string): Promise<any> {
    try {
      // Verify store exists
      const store = await this.prisma.store.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const deleted = await this.prisma.store.delete({
        where: { id },
      });

      return deleted;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Toggle store active status
   */
  async toggleStatus(id: string, organizationId: string): Promise<any> {
    try {
      const store = await this.prisma.store.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      const updated = await this.prisma.store.update({
        where: { id },
        data: {
          isActive: !store.isActive,
        },
        include: {
          office: true,
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
