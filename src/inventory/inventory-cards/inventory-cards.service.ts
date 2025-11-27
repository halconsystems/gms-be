import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateInventoryCardDto, UpdateInventoryCardDto, GetInventoryCardsDto } from './dto';

@Injectable()
export class InventoryCardsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInventoryCardDto, organizationId: string, userId: string): Promise<any> {
    try {
      // Validate store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, organizationId },
      });
      if (!store) {
        throw new BadRequestException('Store not found or does not belong to your organization');
      }

      // Validate guard if provided
      if (dto.guardId) {
        const guard = await this.prisma.guard.findFirst({
          where: { id: dto.guardId, organizationId },
        });
        if (!guard) {
          throw new BadRequestException('Guard not found or does not belong to your organization');
        }
      }

      // Validate all items belong to organization
      if (dto.items && dto.items.length > 0) {
        const itemIds = dto.items.map(i => i.itemId);
        const items = await this.prisma.item.findMany({
          where: { id: { in: itemIds }, organizationId },
        });
        if (items.length !== itemIds.length) {
          throw new BadRequestException('One or more items not found or do not belong to your organization');
        }
      }

      // Create inventory card with items
      const card = await this.prisma.inventoryCard.create({
        data: {
          cardNumber: dto.cardNumber,
          organizationId,
          storeId: dto.storeId,
          guardId: dto.guardId || null,
          notes: dto.notes || null,
          items: {
            create: dto.items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitOfMeasurement: item.unitOfMeasurement || null,
              isNewSupply: item.isNewSupply ?? true,
              serialNumber: item.serialNumber || null,
              condition: (item.condition || 'NEW') as any,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          store: true,
          guard: true,
          items: { include: { item: true } },
        },
      });

      return card;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetInventoryCardsDto): Promise<any> {
    try {
      const { page = 1, limit = 10, storeId, guardId, status, cardNumber } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;
      if (guardId) where.guardId = guardId;
      if (status) where.status = status;
      if (cardNumber) where.cardNumber = { contains: cardNumber };

      const [data, total] = await Promise.all([
        this.prisma.inventoryCard.findMany({
          where,
          skip,
          take: limit,
          include: {
            store: true,
            guard: true,
            items: { include: { item: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.inventoryCard.count({ where }),
      ]);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const card = await this.prisma.inventoryCard.findFirst({
        where: { id, organizationId },
        include: {
          store: true,
          guard: true,
          items: { include: { item: true } },
        },
      });

      if (!card) {
        throw new NotFoundException('Inventory Card not found');
      }

      return card;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateInventoryCardDto, organizationId: string): Promise<any> {
    try {
      const card = await this.prisma.inventoryCard.findFirst({
        where: { id, organizationId },
      });

      if (!card) {
        throw new NotFoundException('Inventory Card not found');
      }

      const updated = await this.prisma.inventoryCard.update({
        where: { id },
        data: {
          notes: dto.notes ?? card.notes,
          status: (dto.status || card.status) as any,
        },
        include: {
          store: true,
          guard: true,
          items: { include: { item: true } },
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async delete(id: string, organizationId: string): Promise<any> {
    try {
      const card = await this.prisma.inventoryCard.findFirst({
        where: { id, organizationId },
      });

      if (!card) {
        throw new NotFoundException('Inventory Card not found');
      }

      await this.prisma.inventoryCard.delete({
        where: { id },
      });

      return { message: 'Inventory Card deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async markAsReturned(id: string, organizationId: string): Promise<any> {
    try {
      const card = await this.prisma.inventoryCard.findFirst({
        where: { id, organizationId },
      });

      if (!card) {
        throw new NotFoundException('Inventory Card not found');
      }

      const updated = await this.prisma.inventoryCard.update({
        where: { id },
        data: {
          returnDate: new Date(),
          status: 'RETURNED' as any,
        },
        include: {
          store: true,
          guard: true,
          items: { include: { item: true } },
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

