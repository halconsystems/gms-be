import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateReturnDto, UpdateReturnDto, GetReturnsDto } from './dto';

@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReturnDto, organizationId: string, userId: string): Promise<any> {
    try {
      // Validate issuance exists and belongs to organization
      const issuance = await this.prisma.issuanceRegister.findFirst({
        where: { id: dto.issuanceId, organizationId },
        include: { items: { include: { item: true } }, guard: true, store: true },
      });
      if (!issuance) {
        throw new BadRequestException('Issuance Register not found or does not belong to your organization');
      }

      // Validate all items in return exist in the issuance
      const issuanceItemIds = new Set(issuance.items.map(i => i.itemId));
      for (const returnItem of dto.items) {
        if (!issuanceItemIds.has(returnItem.itemId)) {
          throw new BadRequestException(
            `Item ${returnItem.itemId} was not part of issuance ${issuance.issueNumber}`
          );
        }
      }

      // Create return register with inventory updates in transaction
      return await this.prisma.$transaction(async (tx) => {
        // Generate return number
        const lastReturn = await tx.returnRegister.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        });
        const nextNumber = (lastReturn?.returnNumber?.split('-')[2] ? parseInt(lastReturn.returnNumber.split('-')[2]) : 0) + 1;
        const returnNumber = `RET-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

        // Calculate total quantity returned
        const totalQuantityReturned = dto.items.reduce((sum, item) => sum + item.quantityReturned, 0);

        // Create return register
        const returnRegister = await tx.returnRegister.create({
          data: {
            returnNumber,
            organizationId,
            issuanceId: dto.issuanceId,
            guardId: issuance.guardId,
            storeId: issuance.storeId,
            receivedBy: userId,
            totalQuantityReturned,
            notes: dto.notes || null,
            items: {
              create: dto.items.map(item => ({
                itemId: item.itemId,
                quantityReturned: item.quantityReturned,
                unitOfMeasurement: item.unitOfMeasurement || null,
                condition: (item.condition || 'GOOD') as any,
                notes: item.notes || null,
              })),
            },
          },
          include: {
            guard: true,
            store: true,
            issuance: true,
            receiver: true,
            items: { include: { item: true } },
          },
        });

        // Adjust inventory - decrement quantityReserved and recompute quantityAvailable
        for (const item of dto.items) {
          const inventory = await tx.inventory.findFirst({
            where: { storeId: issuance.storeId, itemId: item.itemId, organizationId },
          });

          if (!inventory) {
            throw new BadRequestException(
              `Item ${item.itemId} not in store inventory. Cannot return to non-existent inventory.`
            );
          }

          // Validate that quantityReserved is sufficient
          if (inventory.quantityReserved < item.quantityReturned) {
            throw new BadRequestException(
              `Cannot return more than reserved quantity of item ${item.itemId}. Reserved: ${inventory.quantityReserved}, Returned: ${item.quantityReturned}`
            );
          }

          // Decrement quantityReserved and recompute quantityAvailable
          const newQuantityReserved = inventory.quantityReserved - item.quantityReturned;
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantityReserved: newQuantityReserved,
              // Recompute quantityAvailable: quantityOnHand - quantityReserved
              quantityAvailable: inventory.quantityOnHand - newQuantityReserved,
            },
          });

          // Create stock movement record
          await tx.stockMovement.create({
            data: {
              organizationId,
              storeId: issuance.storeId,
              itemId: item.itemId,
              movementType: 'RETURN' as any,
              quantity: item.quantityReturned,
              referenceType: 'ReturnRegister',
              referenceId: returnRegister.id,
              referenceNumber: returnNumber,
              movedBy: userId,
            },
          });
        }

        // Update issuance status based on return quantities
        // Calculate total quantity issued and returned for each item
        const issuanceItemMap = new Map(issuance.items.map((i: any) => [i.itemId, i]));
        const returnItemMap = new Map(dto.items.map((i: any) => [i.itemId, i]));

        let totalIssuedQty = 0;
        let totalReturnedQty = 0;
        let hasPartialReturn = false;

        for (const issuedItem of issuance.items) {
          totalIssuedQty += issuedItem.quantity;
          const returnItem = returnItemMap.get(issuedItem.itemId);
          if (returnItem) {
            totalReturnedQty += returnItem.quantityReturned;
            if (returnItem.quantityReturned < issuedItem.quantity) {
              hasPartialReturn = true;
            }
          } else {
            // No return for this item yet
            hasPartialReturn = true;
          }
        }

        // Determine new issuance status
        const newIssuanceStatus = totalReturnedQty >= totalIssuedQty 
          ? 'FULL_RETURN' 
          : (hasPartialReturn || totalReturnedQty > 0 ? 'PARTIAL_RETURN' : 'ISSUED');

        // Update issuance status
        await tx.issuanceRegister.update({
          where: { id: dto.issuanceId },
          data: { status: newIssuanceStatus as any },
        });

        return returnRegister;
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetReturnsDto): Promise<any> {
    try {
      const { page = 1, limit = 10, storeId, guardId, issuanceId } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (storeId) where.storeId = storeId;
      if (guardId) where.guardId = guardId;
      if (issuanceId) where.issuanceId = issuanceId;

      const [data, total] = await Promise.all([
        this.prisma.returnRegister.findMany({
          where,
          skip,
          take: limit,
          include: {
            guard: true,
            store: true,
            issuance: true,
            receiver: true,
            items: { include: { item: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.returnRegister.count({ where }),
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
      const returnRegister = await this.prisma.returnRegister.findFirst({
        where: { id, organizationId },
        include: {
          guard: true,
          store: true,
          issuance: true,
          receiver: true,
          items: { include: { item: true } },
        },
      });

      if (!returnRegister) {
        throw new NotFoundException('Return Register not found');
      }

      return returnRegister;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateReturnDto, organizationId: string): Promise<any> {
    try {
      const returnRegister = await this.prisma.returnRegister.findFirst({
        where: { id, organizationId },
      });

      if (!returnRegister) {
        throw new NotFoundException('Return Register not found');
      }

      const updated = await this.prisma.returnRegister.update({
        where: { id },
        data: {
          notes: dto.notes ?? returnRegister.notes,
        },
        include: {
          guard: true,
          store: true,
          issuance: true,
          receiver: true,
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
      const returnRegister = await this.prisma.returnRegister.findFirst({
        where: { id, organizationId },
      });

      if (!returnRegister) {
        throw new NotFoundException('Return Register not found');
      }

      await this.prisma.returnRegister.delete({
        where: { id },
      });

      return { message: 'Return Register deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}

