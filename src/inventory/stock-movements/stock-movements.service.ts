import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { GetStockMovementsDto } from './dto';

@Injectable()
export class StockMovementsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, query: GetStockMovementsDto): Promise<any> {
    try {
      const {
        page = 1,
        limit = 10,
        storeId,
        itemId,
        movementType,
        referenceType,
        referenceNumber,
        movedBy,
        startDate,
        endDate,
      } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;
      if (itemId) where.itemId = itemId;
      if (movementType) where.movementType = movementType;
      if (referenceType) where.referenceType = referenceType;
      if (referenceNumber) where.referenceNumber = { contains: referenceNumber };
      if (movedBy) where.movedBy = movedBy;

      // Date range filter
      if (startDate || endDate) {
        where.movementDate = {};
        if (startDate) where.movementDate.gte = new Date(startDate);
        if (endDate) {
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          where.movementDate.lte = endDateTime;
        }
      }

      const [data, total] = await Promise.all([
        this.prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          include: {
            store: true,
            item: true,
            user: true,
          },
          orderBy: { movementDate: 'desc' },
        }),
        this.prisma.stockMovement.count({ where }),
      ]);

      // Calculate aggregates
      const aggregates = await this.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where,
        _sum: {
          quantity: true,
        },
      });

      const aggregateSummary = aggregates.reduce(
        (acc, agg) => {
          acc[agg.movementType] = agg._sum.quantity || 0;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        aggregates: aggregateSummary,
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const movement = await this.prisma.stockMovement.findFirst({
        where: { id, organizationId },
        include: {
          store: true,
          item: true,
          user: true,
        },
      });

      if (!movement) {
        throw new NotFoundException('Stock Movement not found');
      }

      return movement;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getMovementHistory(storeId: string, itemId: string, organizationId: string, query: GetStockMovementsDto): Promise<any> {
    try {
      const { page = 1, limit = 10 } = query;
      const skip = (page - 1) * limit;

      const where: any = {
        organizationId,
        storeId,
        itemId,
      };

      const [data, total] = await Promise.all([
        this.prisma.stockMovement.findMany({
          where,
          skip,
          take: limit,
          include: {
            store: true,
            item: true,
            user: true,
          },
          orderBy: { movementDate: 'desc' },
        }),
        this.prisma.stockMovement.count({ where }),
      ]);

      // Calculate inbound/outbound totals
      const totals = await this.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where,
        _sum: {
          quantity: true,
        },
      });

      const totalInbound = totals
        .filter(t => ['INBOUND', 'TRANSFER', 'RETURN', 'ADJUSTMENT'].includes(t.movementType))
        .reduce((sum, t) => sum + (t._sum.quantity || 0), 0);

      const totalOutbound = totals
        .filter(t => ['OUTBOUND', 'ISSUANCE', 'CONSUMPTION'].includes(t.movementType))
        .reduce((sum, t) => sum + (t._sum.quantity || 0), 0);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        summary: {
          totalInbound,
          totalOutbound,
          netMovement: totalInbound - totalOutbound,
        },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getStoreMovementSummary(storeId: string, organizationId: string): Promise<any> {
    try {
      // Validate store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, organizationId },
      });

      if (!store) {
        throw new NotFoundException('Store not found');
      }

      // Get movement type aggregates for the store
      const aggregates = await this.prisma.stockMovement.groupBy({
        by: ['movementType'],
        where: { storeId, organizationId },
        _sum: {
          quantity: true,
        },
        _count: {
          id: true,
        },
      });

      // Get recent movements
      const recentMovements = await this.prisma.stockMovement.findMany({
        where: { storeId, organizationId },
        take: 20,
        include: {
          item: true,
          user: true,
        },
        orderBy: { movementDate: 'desc' },
      });

      const summary = aggregates.reduce(
        (acc, agg) => {
          acc[agg.movementType] = {
            quantity: agg._sum.quantity || 0,
            count: agg._count.id,
          };
          return acc;
        },
        {} as Record<string, { quantity: number; count: number }>
      );

      return {
        store,
        summary,
        recentMovements,
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

