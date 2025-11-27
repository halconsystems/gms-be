import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateIssuanceDto, UpdateIssuanceDto, GetIssuancesDto } from './dto';

@Injectable()
export class IssuancesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateIssuanceDto, organizationId: string, userId: string): Promise<any> {
    try {
      // Validate guard belongs to organization
      const guard = await this.prisma.guard.findFirst({
        where: { id: dto.guardId, organizationId },
      });
      if (!guard) {
        throw new BadRequestException('Guard not found or does not belong to your organization');
      }

      // Validate store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, organizationId },
      });
      if (!store) {
        throw new BadRequestException('Store not found or does not belong to your organization');
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

      // Create issuance register with inventory adjustments in transaction
      return await this.prisma.$transaction(async (tx) => {
        // Generate issuance number
        const lastIssuance = await tx.issuanceRegister.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        });
        const nextNumber = (lastIssuance?.issueNumber?.split('-')[2] ? parseInt(lastIssuance.issueNumber.split('-')[2]) : 0) + 1;
        const issueNumber = `ISS-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

        // Create issuance register
        const issuance = await tx.issuanceRegister.create({
          data: {
            issueNumber,
            organizationId,
            guardId: dto.guardId,
            storeId: dto.storeId,
            issuedBy: userId,
            notes: dto.notes || null,
            items: {
              create: dto.items.map(item => ({
                itemId: item.itemId,
                quantity: item.quantity,
                unitOfMeasurement: item.unitOfMeasurement || null,
                serialNumber: item.serialNumber || null,
                condition: (item.condition || 'NEW') as any,
                notes: item.notes || null,
              })),
            },
          },
          include: {
            guard: true,
            store: true,
            items: { include: { item: true } },
          },
        });

        // Adjust inventory - increment quantityReserved for issued items
        for (const item of dto.items) {
          const inventory = await tx.inventory.findFirst({
            where: { storeId: dto.storeId, itemId: item.itemId, organizationId },
          });

          if (!inventory) {
            throw new BadRequestException(
              `Item ${item.itemId} not in store inventory. Cannot issue unavailable items.`
            );
          }

          // Check if quantityAvailable (onHand - reserved) is sufficient
          if ((inventory.quantityOnHand - inventory.quantityReserved) < item.quantity) {
            throw new BadRequestException(
              `Insufficient available quantity of item ${item.itemId}. Available: ${inventory.quantityOnHand - inventory.quantityReserved}, Requested: ${item.quantity}`
            );
          }

          // Increment quantityReserved (keep quantityOnHand unchanged)
          const newQuantityReserved = inventory.quantityReserved + item.quantity;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantityReserved: newQuantityReserved,
              // quantityAvailable will be recomputed as: quantityOnHand - quantityReserved
              quantityAvailable: inventory.quantityOnHand - newQuantityReserved,
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              organizationId,
              storeId: dto.storeId,
              itemId: item.itemId,
              movementType: 'ISSUANCE' as any,
              quantity: item.quantity,
              referenceType: 'IssuanceRegister',
              referenceId: issuance.id,
              referenceNumber: issueNumber,
              movedBy: userId,
            },
          });
        }

        return issuance;
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetIssuancesDto): Promise<any> {
    try {
      const { page = 1, limit = 10, storeId, guardId, status } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;
      if (guardId) where.guardId = guardId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        this.prisma.issuanceRegister.findMany({
          where,
          skip,
          take: limit,
          include: {
            guard: true,
            store: true,
            issuer: true,
            items: { include: { item: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.issuanceRegister.count({ where }),
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
      const issuance = await this.prisma.issuanceRegister.findFirst({
        where: { id, organizationId },
        include: {
          guard: true,
          store: true,
          issuer: true,
          items: { include: { item: true } },
          returns: true,
        },
      });

      if (!issuance) {
        throw new NotFoundException('Issuance Register not found');
      }

      return issuance;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateIssuanceDto, organizationId: string): Promise<any> {
    try {
      const issuance = await this.prisma.issuanceRegister.findFirst({
        where: { id, organizationId },
      });

      if (!issuance) {
        throw new NotFoundException('Issuance Register not found');
      }

      const updated = await this.prisma.issuanceRegister.update({
        where: { id },
        data: {
          notes: dto.notes ?? issuance.notes,
          status: (dto.status || issuance.status) as any,
        },
        include: {
          guard: true,
          store: true,
          issuer: true,
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
      const issuance = await this.prisma.issuanceRegister.findFirst({
        where: { id, organizationId },
      });

      if (!issuance) {
        throw new NotFoundException('Issuance Register not found');
      }

      // Only allow deletion if issuance is in ISSUED status
      if (issuance.status !== 'ISSUED') {
        throw new BadRequestException('Can only delete issuances in ISSUED status');
      }

      await this.prisma.issuanceRegister.delete({
        where: { id },
      });

      return { message: 'Issuance Register deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

