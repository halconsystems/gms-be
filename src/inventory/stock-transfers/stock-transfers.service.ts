import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { GetStockTransferDto } from './dto/get-stock-transfer.dto';

@Injectable()
export class StockTransfersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateStockTransferDto, organizationId: string, userId: string): Promise<any> {
    try {
      // Validate stores are different
      if (dto.fromStoreId === dto.toStoreId) {
        throw new BadRequestException('From and To stores must be different');
      }

      // Validate stores belong to organization
      const [fromStore, toStore] = await Promise.all([
        this.prisma.store.findFirst({
          where: { id: dto.fromStoreId, organizationId },
        }),
        this.prisma.store.findFirst({
          where: { id: dto.toStoreId, organizationId },
        }),
      ]);

      if (!fromStore) {
        throw new BadRequestException('From store does not exist or does not belong to this organization');
      }
      if (!toStore) {
        throw new BadRequestException('To store does not exist or does not belong to this organization');
      }

      // Generate transfer number
      const lastTransfer = await this.prisma.stockTransfer.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      const nextNumber = (lastTransfer?.transferNumber?.split('-')[2] ? parseInt(lastTransfer.transferNumber.split('-')[2]) : 0) + 1;
      const transferNumber = `ST-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

      const transfer = await this.prisma.stockTransfer.create({
        data: {
          transferNumber,
          organizationId,
          fromStoreId: dto.fromStoreId,
          toStoreId: dto.toStoreId,
          initiatedBy: userId,
          status: 'DRAFT' as any,
          notes: dto.notes || null,
          items: {
            create: dto.items.map(item => ({
              itemId: item.itemId,
              quantityTransferred: item.quantityTransferred,
              quantityReceived: 0,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          fromStore: true,
          toStore: true,
          initiator: true,
          items: { include: { item: true } },
        },
      });

      return transfer;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetStockTransferDto): Promise<any> {
    try {
      const { page = 1, limit = 10, fromStoreId, toStoreId, status } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (fromStoreId) where.fromStoreId = fromStoreId;
      if (toStoreId) where.toStoreId = toStoreId;
      if (status) where.status = status;

      const [data, total] = await Promise.all([
        this.prisma.stockTransfer.findMany({
          where,
          skip,
          take: limit,
          include: {
            fromStore: true,
            toStore: true,
            initiator: true,
            receiver: true,
            items: { include: { item: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.stockTransfer.count({ where }),
      ]);

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
      const transfer = await this.prisma.stockTransfer.findFirst({
        where: { id, organizationId },
        include: {
          fromStore: true,
          toStore: true,
          initiator: true,
          receiver: true,
          items: { include: { item: true } },
        },
      });

      if (!transfer) {
        throw new NotFoundException('Stock Transfer not found');
      }

      return transfer;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateStockTransferDto, organizationId: string): Promise<any> {
    try {
      const transfer = await this.prisma.stockTransfer.findFirst({
        where: { id, organizationId },
      });

      if (!transfer) {
        throw new NotFoundException('Stock Transfer not found');
      }

      if (transfer.status !== 'DRAFT') {
        throw new BadRequestException('Can only update draft stock transfers');
      }

      let updateData: any = {};
      if (dto.fromStoreId) updateData.fromStoreId = dto.fromStoreId;
      if (dto.toStoreId) updateData.toStoreId = dto.toStoreId;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      if (dto.items) {
        await this.prisma.stockTransferItem.deleteMany({ where: { transferId: id } });
        updateData.items = {
          create: dto.items.map(item => ({
            itemId: item.itemId,
            quantityTransferred: item.quantityTransferred,
            quantityReceived: 0,
            notes: item.notes || null,
          })),
        };
      }

      const updated = await this.prisma.stockTransfer.update({
        where: { id },
        data: updateData,
        include: {
          fromStore: true,
          toStore: true,
          initiator: true,
          items: { include: { item: true } },
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const transfer = await this.prisma.stockTransfer.findFirst({
        where: { id, organizationId },
      });

      if (!transfer) {
        throw new NotFoundException('Stock Transfer not found');
      }

      if (transfer.status !== 'DRAFT') {
        throw new BadRequestException('Can only delete draft stock transfers');
      }

      await this.prisma.stockTransfer.delete({
        where: { id },
      });

      return { message: 'Stock Transfer deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async submit(id: string, organizationId: string): Promise<any> {
    try {
      const transfer = await this.prisma.stockTransfer.findFirst({
        where: { id, organizationId },
      });

      if (!transfer) {
        throw new NotFoundException('Stock Transfer not found');
      }

      if (transfer.status !== 'DRAFT') {
        throw new BadRequestException('Can only submit draft stock transfers');
      }

      return await this.prisma.stockTransfer.update({
        where: { id },
        data: { status: 'IN_TRANSIT' as any },
        include: {
          fromStore: true,
          toStore: true,
          items: { include: { item: true } },
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async receive(id: string, organizationId: string, userId: string, notes?: string): Promise<any> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Fetch transfer with all details
        const transfer = await tx.stockTransfer.findFirst({
          where: { id, organizationId },
          include: {
            items: { include: { item: true } },
            fromStore: true,
            toStore: true,
            initiator: true,
          },
        });

        if (!transfer) {
          throw new NotFoundException('Stock Transfer not found');
        }

        if (transfer.status !== 'IN_TRANSIT') {
          throw new BadRequestException('Can only receive in-transit stock transfers');
        }

        // Verify stores belong to organization
        const fromStore = await tx.store.findFirst({
          where: { id: transfer.fromStoreId, organizationId },
        });
        const toStore = await tx.store.findFirst({
          where: { id: transfer.toStoreId, organizationId },
        });

        if (!fromStore || !toStore) {
          throw new BadRequestException('Stores do not belong to this organization');
        }

        // Process inventory updates and stock movements
        for (const transferItem of transfer.items) {
          const { itemId, quantityTransferred } = transferItem;

          // Get source inventory
          const sourceInventory = await tx.inventory.findFirst({
            where: { storeId: transfer.fromStoreId, itemId, organizationId },
          });

          if (!sourceInventory) {
            throw new BadRequestException(
              `Inventory not found for item ${itemId} in source store`,
            );
          }

          // Validate sufficient stock
          if (sourceInventory.quantityOnHand < quantityTransferred) {
            throw new BadRequestException(
              `Insufficient stock for item ${itemId}. Available: ${sourceInventory.quantityOnHand}, Required: ${quantityTransferred}`,
            );
          }

          // Update source inventory - decrement quantities
          await tx.inventory.update({
            where: { id: sourceInventory.id },
            data: {
              quantityOnHand: sourceInventory.quantityOnHand - quantityTransferred,
              quantityAvailable:
                sourceInventory.quantityAvailable - quantityTransferred,
            },
          });

          // Create outbound stock movement for source store
          await tx.stockMovement.create({
            data: {
              organizationId,
              storeId: transfer.fromStoreId,
              itemId,
              movementType: 'TRANSFER',
              quantity: quantityTransferred,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              referenceNumber: transfer.transferNumber,
              movedBy: userId,
              notes: notes || `Stock transfer out to ${toStore.name}`,
            },
          });

          // Get or create destination inventory
          let destInventory = await tx.inventory.findFirst({
            where: { storeId: transfer.toStoreId, itemId, organizationId },
          });

          if (!destInventory) {
            destInventory = await tx.inventory.create({
              data: {
                organizationId,
                storeId: transfer.toStoreId,
                itemId,
                quantityOnHand: quantityTransferred,
                quantityReserved: 0,
                quantityAvailable: quantityTransferred,
              },
            });
          } else {
            // Update destination inventory - increment quantities
            await tx.inventory.update({
              where: { id: destInventory.id },
              data: {
                quantityOnHand: destInventory.quantityOnHand + quantityTransferred,
                quantityAvailable:
                  destInventory.quantityAvailable + quantityTransferred,
              },
            });
          }

          // Create inbound stock movement for destination store
          await tx.stockMovement.create({
            data: {
              organizationId,
              storeId: transfer.toStoreId,
              itemId,
              movementType: 'TRANSFER',
              quantity: quantityTransferred,
              referenceType: 'TRANSFER',
              referenceId: transfer.id,
              referenceNumber: transfer.transferNumber,
              movedBy: userId,
              notes: notes || `Stock transfer in from ${fromStore.name}`,
            },
          });
        }

        // Update transfer status
        const updatedTransfer = await tx.stockTransfer.update({
          where: { id },
          data: {
            status: 'RECEIVED' as any,
            receivedBy: userId,
            receivedDate: new Date(),
          },
          include: {
            fromStore: true,
            toStore: true,
            receiver: true,
            initiator: true,
            items: { include: { item: true } },
          },
        });

        return updatedTransfer;
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async cancel(id: string, organizationId: string, notes?: string): Promise<any> {
    try {
      const transfer = await this.prisma.stockTransfer.findFirst({
        where: { id, organizationId },
      });

      if (!transfer) {
        throw new NotFoundException('Stock Transfer not found');
      }

      if (!['DRAFT', 'IN_TRANSIT'].includes(transfer.status as any)) {
        throw new BadRequestException('Can only cancel draft or in-transit stock transfers');
      }

      return await this.prisma.stockTransfer.update({
        where: { id },
        data: {
          status: 'CANCELLED' as any,
          notes: notes || transfer.notes,
        },
        include: {
          fromStore: true,
          toStore: true,
          items: { include: { item: true } },
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
