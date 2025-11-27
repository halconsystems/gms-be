import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { GetItemDto } from './dto/get-item.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateItemDto, organizationId: string): Promise<any> {
    try {
      // Check SKU uniqueness within organization
      const existingSku = await this.prisma.item.findFirst({
        where: { sku: dto.sku, organizationId },
      });

      if (existingSku) {
        throw new BadRequestException(`SKU '${dto.sku}' already exists in this organization`);
      }

      // Check barcode uniqueness within organization (if barcode is provided)
      if (dto.barcode) {
        const existingBarcode = await this.prisma.item.findFirst({
          where: { barcode: dto.barcode, organizationId },
        });

        if (existingBarcode) {
          throw new BadRequestException(`Barcode '${dto.barcode}' already exists in this organization`);
        }
      }

      // Verify category and group belong to organization
      const [category, group] = await Promise.all([
        this.prisma.itemCategory.findFirst({
          where: { id: dto.categoryId, organizationId },
        }),
        this.prisma.itemGroup.findFirst({
          where: { id: dto.groupId, organizationId },
        }),
      ]);

      if (!category) {
        throw new BadRequestException('Invalid category for this organization');
      }
      if (!group) {
        throw new BadRequestException('Invalid group for this organization');
      }

      return await this.prisma.item.create({
        data: {
          organizationId,
          name: dto.name,
          sku: dto.sku,
          barcode: dto.barcode,
          description: dto.description,
          categoryId: dto.categoryId,
          groupId: dto.groupId,
          unitOfMeasurement: dto.unitOfMeasurement,
          imagePath: dto.imagePath,
          reorderLevel: dto.reorderLevel,
          reorderQuantity: dto.reorderQuantity,
          minStockLevel: dto.minStockLevel,
          maxStockLevel: dto.maxStockLevel,
          initialPrice: dto.initialPrice ? parseFloat(dto.initialPrice.toString()) : null,
          initialPurchaseDate: dto.initialPurchaseDate,
          expiryDays: dto.expiryDays,
          servicePeriod: dto.servicePeriod,
          preferredVendorId: dto.preferredVendorId,
          isActive: true,
        },
        include: { category: true, group: true, preferredVendor: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, dto: GetItemDto): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = { organizationId };

      if (dto.categoryId) {
        where.categoryId = dto.categoryId;
      }

      if (dto.groupId) {
        where.groupId = dto.groupId;
      }

      if (dto.isActive !== undefined) {
        where.isActive = dto.isActive;
      }

      if (dto.search) {
        where.OR = [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { sku: { contains: dto.search, mode: 'insensitive' } },
          { barcode: { contains: dto.search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.item.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { category: true, group: true, preferredVendor: true },
        }),
        this.prisma.item.count({ where }),
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

  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { id, organizationId },
        include: { category: true, group: true, preferredVendor: true },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return item;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateItemDto, organizationId: string): Promise<any> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { id, organizationId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return await this.prisma.item.update({
        where: { id },
        data: dto,
        include: { category: true, group: true, preferredVendor: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { id, organizationId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return await this.prisma.item.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async toggleStatus(id: string, organizationId: string): Promise<any> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { id, organizationId },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return await this.prisma.item.update({
        where: { id },
        data: { isActive: !item.isActive },
        include: { category: true, group: true, preferredVendor: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getStockLevels(id: string, organizationId: string): Promise<any> {
    try {
      const item = await this.prisma.item.findFirst({
        where: { id, organizationId },
        include: {
          category: true,
          group: true,
          preferredVendor: true,
          inventory: {
            include: { store: true },
          },
        },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      const stockLevels = item.inventory || [];

      return {
        item,
        stockLevels,
        totalStockOnHand: stockLevels.reduce((sum: number, inv: any) => sum + inv.quantityOnHand, 0),
        totalStockAvailable: stockLevels.reduce((sum: number, inv: any) => sum + inv.quantityAvailable, 0),
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
