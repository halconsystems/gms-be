import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { GetInventoryDto } from './dto/get-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInventoryDto, organizationId: string): Promise<any> {
    try {
      // Validate store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, organizationId },
      });

      if (!store) {
        throw new BadRequestException('Store does not exist or does not belong to this organization');
      }

      // Validate item belongs to organization
      const item = await this.prisma.item.findFirst({
        where: { id: dto.itemId, organizationId },
      });

      if (!item) {
        throw new BadRequestException('Item does not exist or does not belong to this organization');
      }

      // Check if inventory already exists for this store-item combination
      const existing = await this.prisma.inventory.findUnique({
        where: {
          storeId_itemId: {
            storeId: dto.storeId,
            itemId: dto.itemId,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Inventory already exists for this store-item combination');
      }

      return await this.prisma.inventory.create({
        data: {
          organizationId,
          storeId: dto.storeId,
          itemId: dto.itemId,
          quantityOnHand: 0,
          quantityReserved: 0,
          quantityAvailable: 0,
          minStockLevel: dto.minStockLevel || null,
          maxStockLevel: dto.maxStockLevel || null,
        },
        include: {
          store: true,
          item: true,
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetInventoryDto): Promise<any> {
    try {
      const { page = 1, limit = 10, storeId, itemId, isLowStock } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;
      if (itemId) where.itemId = itemId;

      let data = await this.prisma.inventory.findMany({
        where,
        skip,
        take: limit,
        include: {
          store: true,
          item: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Filter low stock items if requested
      if (isLowStock) {
        data = data.filter(inv => {
          const minLevel = inv.minStockLevel || 0;
          return inv.quantityOnHand <= minLevel;
        });
      }

      const total = await this.prisma.inventory.count({ where });

      return {
        data,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { id, organizationId },
        include: {
          store: true,
          item: true,
        },
      });

      if (!inventory) {
        throw new NotFoundException('Inventory not found');
      }

      return inventory;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateInventoryDto, organizationId: string): Promise<any> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { id, organizationId },
      });

      if (!inventory) {
        throw new NotFoundException('Inventory not found');
      }

      return await this.prisma.inventory.update({
        where: { id },
        data: {
          minStockLevel: dto.minStockLevel !== undefined ? dto.minStockLevel : inventory.minStockLevel,
          maxStockLevel: dto.maxStockLevel !== undefined ? dto.maxStockLevel : inventory.maxStockLevel,
        },
        include: {
          store: true,
          item: true,
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { id, organizationId },
      });

      if (!inventory) {
        throw new NotFoundException('Inventory not found');
      }

      await this.prisma.inventory.delete({
        where: { id },
      });

      return { message: 'Inventory deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getByStoreAndItem(storeId: string, itemId: string, organizationId: string): Promise<any> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: {
          organizationId,
          storeId,
          itemId,
        },
        include: {
          store: true,
          item: true,
        },
      });

      return inventory || null;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async updateQuantity(
    id: string,
    organizationId: string,
    quantityOnHand: number,
    quantityReserved: number,
  ): Promise<any> {
    try {
      const inventory = await this.prisma.inventory.findFirst({
        where: { id, organizationId },
      });

      if (!inventory) {
        throw new NotFoundException('Inventory not found');
      }

      const quantityAvailable = quantityOnHand - quantityReserved;

      return await this.prisma.inventory.update({
        where: { id },
        data: {
          quantityOnHand,
          quantityReserved,
          quantityAvailable,
          lastCountedDate: new Date(),
        },
        include: {
          store: true,
          item: true,
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getStockLevelsForStore(organizationId: string, storeId: string): Promise<any> {
    try {
      // Verify store exists and belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, organizationId },
      });

      if (!store) {
        throw new NotFoundException('Store does not exist or does not belong to this organization');
      }

      const inventories = await this.prisma.inventory.findMany({
        where: { organizationId, storeId },
        include: {
          store: true,
          item: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      return {
        store,
        inventories,
        totalItems: inventories.length,
        summary: {
          totalQuantityOnHand: inventories.reduce((sum, inv) => sum + inv.quantityOnHand, 0),
          totalQuantityReserved: inventories.reduce((sum, inv) => sum + inv.quantityReserved, 0),
          totalQuantityAvailable: inventories.reduce((sum, inv) => sum + inv.quantityAvailable, 0),
        },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getLowStock(organizationId: string, storeId?: string): Promise<any> {
    try {
      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;

      const lowStockItems = await this.prisma.inventory.findMany({
        where,
        include: {
          store: true,
          item: true,
        },
      });

      return lowStockItems.filter(inv => {
        const minLevel = inv.minStockLevel || 0;
        return inv.quantityOnHand <= minLevel;
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
