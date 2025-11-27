import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { GRNStatus, GRNType, MovementType, POStatus } from 'src/prisma/prisma.types';
import { PaginatedResponse } from '../common/interfaces/prisma.types';

/**
 * GRN Service
 * Handles CRUD operations for Goods Receipt Notes (GRN)
 * Manages receipt of goods from vendors, inventory updates, and stock movements
 * Multi-tenant support with organizationId filtering
 */
@Injectable()
export class GrnService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new GRN manually
   * Generates unique GRN number and initializes with PENDING status
   *
   * @param dto - GRN creation DTO with storeId, vendorId, items
   * @param organizationId - Organization ID for multi-tenant support
   * @param userId - User ID of the person creating the GRN
   * @returns Created GRN with items
   * @throws BadRequestException - If store or vendor not found or invalid
   * @throws ConflictException - If GRN number already exists
   */
  async create(
    dto: any,
    organizationId: string,
    userId: string,
  ): Promise<any> {
    try {
      // Validate that store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: {
          id: dto.storeId,
          organizationId,
        },
      });

      if (!store) {
        throw new BadRequestException(
          'Store not found or does not belong to this organization',
        );
      }

      // Validate that vendor belongs to organization
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          id: dto.vendorId,
          organizationId,
        },
      });

      if (!vendor) {
        throw new BadRequestException(
          'Vendor not found or does not belong to this organization',
        );
      }

      // Validate all items belong to organization
      if (dto.items && dto.items.length > 0) {
        const itemIds = dto.items.map((i: any) => i.itemId);
        const items = await this.prisma.item.findMany({
          where: { id: { in: itemIds }, organizationId },
        });
        if (items.length !== itemIds.length) {
          throw new BadRequestException('One or more items not found or do not belong to your organization');
        }
      }

      // If PO is provided, validate it and its items
      if (dto.poId) {
        const po = await this.prisma.purchaseOrder.findFirst({
          where: {
            id: dto.poId,
            organizationId,
          },
          include: {
            items: true,
          },
        });

        if (!po) {
          throw new BadRequestException('Purchase Order not found or does not belong to this organization');
        }

        // Validate each GRN item against PO items
        if (dto.items && dto.items.length > 0) {
          const poItemMap = new Map(po.items.map((pi: any) => [pi.id, pi]));

          for (const grnItem of dto.items) {
            if (grnItem.poItemId) {
              const poItem = poItemMap.get(grnItem.poItemId);

              if (!poItem) {
                throw new BadRequestException(
                  `PO Item ${grnItem.poItemId} not found in this Purchase Order`,
                );
              }

              // Validate quantity received doesn't exceed PO quantity ordered
              if ((grnItem.quantityReceived || 0) > (poItem.quantityOrdered || 0)) {
                throw new BadRequestException(
                  `For PO Item: quantity received (${grnItem.quantityReceived}) cannot exceed quantity ordered (${poItem.quantityOrdered})`,
                );
              }

              // Validate total received (existing + new) doesn't exceed PO quantity
              const totalReceived = (poItem.quantityReceived || 0) + (grnItem.quantityReceived || 0);
              if (totalReceived > (poItem.quantityOrdered || 0)) {
                throw new BadRequestException(
                  `For PO Item: total received quantity (${totalReceived}) would exceed ordered quantity (${poItem.quantityOrdered})`,
                );
              }
            }
          }
        }
      }

      // Generate unique GRN number
      const grnNumber = await this.generateGrnNumber(organizationId);

      // Calculate total quantity and amount from client data
      const totalQuantity = dto.items.reduce(
        (sum: number, item: any) => sum + (item.quantityReceived || 0),
        0,
      );

      const totalAmount = dto.items.reduce((sum: number, item: any) => {
        const unitPrice = typeof item.unitPrice === 'string' 
          ? parseFloat(item.unitPrice) 
          : item.unitPrice?.toNumber?.() || 0;
        const itemTotal = (item.quantityReceived || 0) * unitPrice;
        return sum + itemTotal;
      }, 0);

      // Create GRN with items - manual entry with client data
      const grn = await this.prisma.grn.create({
        data: {
          organizationId,
          grnNumber,
          poId: dto.poId || null,
          storeId: dto.storeId,
          vendorId: dto.vendorId,
          grnType: dto.grnType || GRNType.PURCHASE,
          status: GRNStatus.PENDING,
          receivedBy: userId,
          receivedDate: new Date(),
          totalQuantity,
          totalAmount: totalAmount.toString(),
          notes: dto.notes,
          items: {
            create: dto.items.map((item: any) => ({
              itemId: item.itemId,
              poItemId: item.poItemId || null,
              quantityOrdered: item.quantityOrdered || item.quantityReceived,
              quantityReceived: item.quantityReceived,
              quantityAccepted: 0,
              quantityRejected: 0,
              unitPrice: typeof item.unitPrice === 'string' 
                ? item.unitPrice 
                : item.unitPrice?.toString?.() || '0',
              totalPrice: (
                (item.quantityReceived || 0) * 
                (typeof item.unitPrice === 'string' 
                  ? parseFloat(item.unitPrice) 
                  : item.unitPrice?.toNumber?.() || 0)
              ).toString(),
              conditionStatus: item.conditionStatus || 'GOOD',
              batchNumber: item.batchNumber || null,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              serialNumber: item.serialNumber || null,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          items: {
            include: {
              item: true,
              poItem: true,
            },
          },
          purchaseOrder: true,
          store: true,
          vendor: true,
          receiver: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
        },
      });

      return grn;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Get all GRNs for an organization with pagination and filtering
   * Supports filtering by status, poId, storeId, and search by grnNumber/vendor name
   *
   * @param organizationId - Organization ID
   * @param filters - Pagination and filter options
   * @returns Paginated list of GRNs
   */
  async findAll(
    organizationId: string,
    filters: any,
  ): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((filters.page || 1) - 1) * (filters.limit || 10);
      const take = filters.limit || 10;

      const where: any = {
        organizationId,
      };

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.poId) {
        where.poId = filters.poId;
      }

      if (filters.storeId) {
        where.storeId = filters.storeId;
      }

      if (filters.vendorId) {
        where.vendorId = filters.vendorId;
      }

      if (filters.search) {
        where.OR = [
          { grnNumber: { contains: filters.search, mode: 'insensitive' } },
          { vendor: { name: { contains: filters.search, mode: 'insensitive' } } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.grn.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                item: true,
              },
            },
            purchaseOrder: true,
            store: true,
            vendor: true,
            receiver: {
              select: {
                id: true,
                email: true,
                userName: true,
              },
            },
            inspector: {
              select: {
                id: true,
                email: true,
                userName: true,
              },
            },
          },
        }),
        this.prisma.grn.count({ where }),
      ]);

      return {
        data,
        total,
        page: filters.page || 1,
        limit: filters.limit || 10,
        totalPages: Math.ceil(total / (filters.limit || 10)),
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Get a single GRN by ID with all its items
   * Retrieves detailed information including related PO, store, and vendor data
   *
   * @param id - GRN ID
   * @param organizationId - Organization ID
   * @returns Complete GRN record with items and relationships
   * @throws NotFoundException - If GRN not found
   */
  async findOne(id: string, organizationId: string): Promise<any> {
    try {
      const grn = await this.prisma.grn.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          items: {
            include: {
              item: true,
              poItem: true,
            },
          },
          purchaseOrder: {
            include: {
              items: true,
              vendor: true,
            },
          },
          store: {
            include: {
              office: true,
            },
          },
          vendor: true,
          receiver: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
          inspector: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      return grn;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Update GRN details (grnNumber, notes, status can be updated before receipt)
   * Restricted to PENDING status GRNs
   *
   * @param id - GRN ID
   * @param dto - Update DTO with fields to update
   * @param organizationId - Organization ID
   * @returns Updated GRN record
   * @throws NotFoundException - If GRN not found
   * @throws BadRequestException - If GRN status doesn't allow updates
   */
  async update(
    id: string,
    dto: any,
    organizationId: string,
  ): Promise<any> {
    try {
      // Verify GRN exists and belongs to organization
      const grn = await this.prisma.grn.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      // Only allow updates for PENDING status
      if (grn.status !== GRNStatus.PENDING) {
        throw new BadRequestException(
          'Can only update GRNs with PENDING status',
        );
      }

      const updated = await this.prisma.grn.update({
        where: { id },
        data: {
          notes: dto.notes,
        },
        include: {
          items: {
            include: {
              item: true,
            },
          },
          purchaseOrder: true,
          store: true,
          vendor: true,
          receiver: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Delete/Cancel a GRN
   * Can only delete GRNs with PENDING or REJECTED status
   *
   * @param id - GRN ID
   * @param organizationId - Organization ID
   * @returns Deleted GRN record
   * @throws NotFoundException - If GRN not found
   * @throws BadRequestException - If GRN status doesn't allow deletion
   */
  async remove(id: string, organizationId: string): Promise<any> {
    try {
      // Verify GRN exists and belongs to organization
      const grn = await this.prisma.grn.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      // Only allow deletion for PENDING or REJECTED status
      if (
        grn.status !== GRNStatus.PENDING &&
        grn.status !== GRNStatus.REJECTED
      ) {
        throw new BadRequestException(
          'Can only delete GRNs with PENDING or REJECTED status',
        );
      }

      const deleted = await this.prisma.grn.delete({
        where: { id },
      });

      return deleted;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Set GRN status to INSPECTING
   * Marks goods as under inspection by specified inspector
   * Transition: PENDING -> INSPECTING
   *
   * @param id - GRN ID
   * @param organizationId - Organization ID
   * @param userId - User ID of the inspector
   * @returns Updated GRN with INSPECTING status
   * @throws NotFoundException - If GRN not found
   * @throws BadRequestException - If GRN status is not PENDING
   */
  async setInspecting(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<any> {
    try {
      // Verify GRN exists and belongs to organization
      const grn = await this.prisma.grn.findFirst({
        where: {
          id,
          organizationId,
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      // Can only transition from PENDING to INSPECTING
      if (grn.status !== GRNStatus.PENDING) {
        throw new BadRequestException(
          'GRN status must be PENDING to start inspection',
        );
      }

      const updated = await this.prisma.grn.update({
        where: { id },
        data: {
          status: GRNStatus.INSPECTING,
          inspectedBy: userId,
          inspectionDate: new Date(),
        },
        include: {
          items: {
            include: {
              item: true,
            },
          },
          purchaseOrder: true,
          store: true,
          vendor: true,
          receiver: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
          inspector: {
            select: {
              id: true,
              email: true,
              userName: true,
            },
          },
        },
      });

      return updated;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * CRITICAL: Receive goods and update inventory
   * Main operation that processes accepted goods and updates inventory
   * Uses Prisma transaction to ensure data consistency
   *
   * Transaction steps:
   * 1. Validate GRN and items
   * 2. Update GrnItem quantities (accepted/rejected)
   * 3. Update or create Inventory records (quantityOnHand += accepted qty)
   * 4. Create StockMovement records for audit trail (type=INBOUND)
   * 5. Update PurchaseOrderItem.quantityReceived
   * 6. Update GRN status to RECEIVED or PARTIAL
   * 7. Update PurchaseOrder status based on all items received
   *
   * Validations:
   * - quantityAccepted + quantityRejected <= quantityReceived
   * - quantityReceived <= quantityOrdered
   * - GRN must be in PENDING or INSPECTING status
   *
   * @param id - GRN ID
   * @param dto - DTO with items array containing itemId, quantityAccepted, quantityRejected
   * @param organizationId - Organization ID
   * @param userId - User ID of the person receiving goods
   * @returns Updated GRN with new status and inventory records
   * @throws NotFoundException - If GRN not found
   * @throws BadRequestException - If quantities invalid or GRN already received
   * @throws ConflictException - If quantities exceed limits
   */
  async receiveGoods(
    id: string,
    dto: any,
    organizationId: string,
    userId: string,
  ): Promise<any> {
    try {
      // Fetch GRN with all details
      const grn = await this.prisma.grn.findFirst({
        where: {
          id,
          organizationId,
        },
        include: {
          items: {
            include: {
              item: true,
              poItem: true,
            },
          },
          purchaseOrder: {
            include: {
              items: true,
            },
          },
          store: true,
          vendor: true,
        },
      });

      if (!grn) {
        throw new NotFoundException('GRN not found');
      }

      // Check GRN status - can only receive from PENDING or INSPECTING
      if (
        grn.status !== GRNStatus.PENDING &&
        grn.status !== GRNStatus.INSPECTING
      ) {
        throw new BadRequestException(
          'GRN must be in PENDING or INSPECTING status to receive goods',
        );
      }

      // Validate items array
      if (!dto.items || !Array.isArray(dto.items) || dto.items.length === 0) {
        throw new BadRequestException('Items array is required and must not be empty');
      }

      // Validate quantities for each item
      const grnItemMap = new Map(grn.items.map((item) => [item.id, item]));
      let totalAccepted = 0;

      for (const receiveItem of dto.items) {
        const grnItem = grnItemMap.get(receiveItem.grnItemId) as any;
        if (!grnItem) {
          throw new BadRequestException(
            `GRN item ${receiveItem.grnItemId} not found`,
          );
        }

        const quantityAccepted = receiveItem.quantityAccepted || 0;
        const quantityRejected = receiveItem.quantityRejected || 0;

        // Validate: accepted + rejected <= received
        if (quantityAccepted + quantityRejected > grnItem.quantityReceived) {
          throw new ConflictException(
            `For item ${grnItem.item.sku}: accepted (${quantityAccepted}) + rejected (${quantityRejected}) cannot exceed received (${grnItem.quantityReceived})`,
          );
        }

        // Validate: received <= ordered
        if (grnItem.quantityReceived > (grnItem.quantityOrdered || 0)) {
          throw new ConflictException(
            `For item ${grnItem.item.sku}: received (${grnItem.quantityReceived}) cannot exceed ordered (${grnItem.quantityOrdered})`,
          );
        }

        totalAccepted += quantityAccepted;
      }

      // Use Prisma transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Step 1: Update GrnItem quantities and collect movement data
        const movementRecords: any[] = [];

        for (const receiveItem of dto.items) {
          const grnItem = grnItemMap.get(receiveItem.grnItemId) as any;

          // Update GrnItem
          await tx.grnItem.update({
            where: { id: receiveItem.grnItemId },
            data: {
              quantityAccepted: receiveItem.quantityAccepted || 0,
              quantityRejected: receiveItem.quantityRejected || 0,
            },
          });

          // Prepare movement record data
          if (receiveItem.quantityAccepted > 0) {
            movementRecords.push({
              organizationId,
              storeId: grn.storeId,
              itemId: grnItem.itemId,
              movementType: MovementType.INBOUND,
              quantity: receiveItem.quantityAccepted,
              referenceType: 'GRN',
              referenceId: grn.id,
              referenceNumber: grn.grnNumber,
              movedBy: userId,
              movementDate: new Date(),
              notes: `Goods received for GRN ${grn.grnNumber}`,
            });
          }
        }

        // Step 2: Update or create Inventory records for accepted items
        for (const receiveItem of dto.items) {
          if (receiveItem.quantityAccepted > 0) {
            const grnItem = grnItemMap.get(receiveItem.grnItemId) as any;

            // Check if inventory record exists
            const existingInventory = await tx.inventory.findFirst({
              where: {
                organizationId,
                storeId: grn.storeId,
                itemId: grnItem.itemId,
              },
            });

            if (existingInventory) {
              // Update existing inventory
              await tx.inventory.update({
                where: { id: existingInventory.id },
                data: {
                  quantityOnHand: {
                    increment: receiveItem.quantityAccepted,
                  },
                  quantityAvailable: {
                    increment: receiveItem.quantityAccepted,
                  },
                  lastCountedDate: new Date(),
                },
              });
            } else {
              // Create new inventory record
              await tx.inventory.create({
                data: {
                  organizationId,
                  storeId: grn.storeId,
                  itemId: grnItem.itemId,
                  quantityOnHand: receiveItem.quantityAccepted,
                  quantityReserved: 0,
                  quantityAvailable: receiveItem.quantityAccepted,
                  lastCountedDate: new Date(),
                },
              });
            }
          }
        }

        // Step 3: Create StockMovement records for audit trail
        for (const movement of movementRecords) {
          await tx.stockMovement.create({
            data: movement,
          });
        }

        // Step 4: Update PurchaseOrderItem.quantityReceived
        let poFullyReceived = true;

        for (const receiveItem of dto.items) {
          const grnItem = grnItemMap.get(receiveItem.grnItemId) as any;
          const poItem = grnItem.poItem;

          if (poItem) {
            const newQuantityReceived =
              (poItem.quantityReceived || 0) +
              (receiveItem.quantityAccepted || 0);

            if (newQuantityReceived > poItem.quantityOrdered) {
              throw new ConflictException(
                `For PO item ${poItem.id}: total received would exceed ordered quantity`,
              );
            }

            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                quantityReceived: newQuantityReceived,
              },
            });

            if (newQuantityReceived < poItem.quantityOrdered) {
              poFullyReceived = false;
            }
          }
        }

        // Step 5: Determine GRN status (RECEIVED or PARTIAL)
        const allItemsFullyReceived = grn.items.every((item) => {
          const receiveItem = dto.items.find(
            (r: any) => r.grnItemId === item.id,
          );
          return (
            receiveItem &&
            receiveItem.quantityAccepted === item.quantityReceived
          );
        });

        const grnNewStatus = allItemsFullyReceived
          ? GRNStatus.RECEIVED
          : GRNStatus.PARTIAL;

        // Step 6: Update GRN status
        const updatedGrn = await tx.grn.update({
          where: { id },
          data: {
            status: grnNewStatus,
            totalQuantity: totalAccepted,
          },
          include: {
            items: {
              include: {
                item: true,
                poItem: true,
              },
            },
            purchaseOrder: {
              include: {
                items: true,
              },
            },
            store: true,
            vendor: true,
            receiver: {
              select: {
                id: true,
                email: true,
                userName: true,
              },
            },
            inspector: {
              select: {
                id: true,
                email: true,
                userName: true,
              },
            },
          },
        });

        // Step 7: Update PurchaseOrder status
        const poItems = await tx.purchaseOrderItem.findMany({
          where: {
            poId: grn.purchaseOrder.id,
          },
        });

        let poStatus: any = 'RECEIVED';
        const anyPartiallyReceived = poItems.some(
          (item) => item.quantityReceived > 0 && item.quantityReceived < item.quantityOrdered,
        );
        const anyPending = poItems.some(
          (item) => item.quantityReceived === 0,
        );

        if (anyPartiallyReceived || (anyPending && !anyPartiallyReceived)) {
          poStatus = 'PARTIALLY_RECEIVED';
        }

        await tx.purchaseOrder.update({
          where: { id: grn.purchaseOrder.id },
          data: {
            status: poStatus,
          },
        });

        return updatedGrn;
      });

      return result;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  /**
   * Generate unique GRN number based on organization and current date
   * Format: GRN-YYYY-NNNNN (e.g., GRN-2024-00001)
   *
   * @param organizationId - Organization ID
   * @returns Generated GRN number string
   * @private
   */
  private async generateGrnNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;

    // Find the highest sequence number for this year in this organization
    const lastGrn = await this.prisma.grn.findFirst({
      where: {
        organizationId,
        grnNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        grnNumber: 'desc',
      },
      select: {
        grnNumber: true,
      },
    });

    let sequence = 1;
    if (lastGrn) {
      const lastSequence = parseInt(lastGrn.grnNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }

    // Format with leading zeros (5 digits: 00001-99999)
    return `${prefix}${sequence.toString().padStart(5, '0')}`;
  }
}
