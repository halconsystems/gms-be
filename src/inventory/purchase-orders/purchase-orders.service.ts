import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { POStatus, PaymentStatus } from '@prisma/client';
import { PRStatus } from 'src/prisma/prisma.types';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { GetPurchaseOrderDto } from './dto/get-purchase-order.dto';
import { ConvertPrToPoDto } from './dto/convert-pr-to-po.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePurchaseOrderDto, organizationId: string, userId: string): Promise<any> {
    try {
      console.log('[PurchaseOrdersService] Creating PO with:', { organizationId, userId, itemCount: dto.items?.length });

      // Validate user exists
      if (userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user) {
          console.warn(`[PurchaseOrdersService] User ${userId} not found`);
          throw new BadRequestException('Current user is not valid');
        }
      }

      // If prId is provided, validate PR belongs to organization and is APPROVED
      if (dto.prId) {
        const pr = await this.prisma.purchaseRequest.findFirst({
          where: { id: dto.prId, organizationId },
        });
        if (!pr) {
          throw new BadRequestException('Purchase Request not found or does not belong to your organization');
        }
        if (pr.status !== PRStatus.APPROVED) {
          throw new BadRequestException(`Purchase Request must be in APPROVED status. Current status: ${pr.status}`);
        }
      }

      // Validate all items belong to organization
      if (dto.items && dto.items.length > 0) {
        const itemIds = dto.items.map(item => item.itemId);
        const validItems = await this.prisma.item.findMany({
          where: {
            id: { in: itemIds },
            organizationId,
          },
          select: { id: true },
        });

        const validItemIds = new Set(validItems.map(i => i.id));
        const invalidItems = itemIds.filter(itemId => !validItemIds.has(itemId));

        if (invalidItems.length > 0) {
          throw new BadRequestException(
            `The following items do not exist or do not belong to your organization: ${invalidItems.join(', ')}. Please verify item IDs and try again.`
          );
        }
      }

      // Generate PO number
      const lastPO = await this.prisma.purchaseOrder.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      const nextNumber = (lastPO?.poNumber?.split('-')[2] ? parseInt(lastPO.poNumber.split('-')[2]) : 0) + 1;
      const poNumber = `PO-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

      // Calculate net amount
      const taxAmount = dto.taxAmount ? parseFloat(dto.taxAmount) : 0;
      const shippingCost = dto.shippingCost ? parseFloat(dto.shippingCost) : 0;
      const discountAmount = dto.discountAmount ? parseFloat(dto.discountAmount) : 0;
      const totalAmount = dto.items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);
      const netAmount = totalAmount + taxAmount + shippingCost - discountAmount;

      // Create purchase order with items
      const po = await this.prisma.purchaseOrder.create({
        data: {
          poNumber,
          organizationId,
          officeId: dto.officeId || null,
          orderedBy: userId,
          prId: dto.prId || null,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          status: POStatus.DRAFT,
          paymentStatus: PaymentStatus.PENDING,
          totalAmount: totalAmount.toString(),
          taxAmount: dto.taxAmount || null,
          shippingCost: dto.shippingCost || null,
          discountAmount: dto.discountAmount || null,
          netAmount: netAmount.toString(),
          notes: dto.notes || null,
          items: {
            create: dto.items.map(item => ({
              itemId: item.itemId,
              quantityOrdered: item.quantityOrdered,
              quantityReceived: 0,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          creator: true,
          office: true,
          items: { include: { item: true } },
        },
      });

      return po;
    } catch (error) {
      console.error('[PurchaseOrdersService] Error creating PO:', {
        error: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, query: GetPurchaseOrderDto): Promise<any> {
    try {
      const { page = 1, limit = 10, prId, status, paymentStatus } = query;
      const skip = (page - 1) * limit;

      const where: any = { organizationId };
      if (prId) where.prId = prId;
      if (status) where.status = status;
      if (paymentStatus) where.paymentStatus = paymentStatus;

      const [data, total] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where,
          skip,
          take: limit,
          include: {
            creator: true,
            office: true,
            organization: true,
            items: { include: { item: true } },
            purchaseRequest: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.purchaseOrder.count({ where }),
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
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
        include: {
          creator: true,
          office: true,
          organization: true,
          items: { include: { item: true } },
          purchaseRequest: true,
          grns: { include: { items: true } },
        },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      return po;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdatePurchaseOrderDto, organizationId: string): Promise<any> {
    try {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      if (po.status !== POStatus.DRAFT) {
        throw new BadRequestException('Can only update draft purchase orders');
      }

      // Recalculate amounts if items are being updated
      let updateData: any = { ...dto };
      if (dto.items) {
        // Validate all items belong to organization
        const itemIds = dto.items.map((item: any) => item.itemId);
        const validItems = await this.prisma.item.findMany({
          where: {
            id: { in: itemIds },
            organizationId,
          },
          select: { id: true },
        });

        const validItemIds = new Set(validItems.map(i => i.id));
        const invalidItems = itemIds.filter(itemId => !validItemIds.has(itemId));

        if (invalidItems.length > 0) {
          throw new BadRequestException(
            `The following items do not exist or do not belong to your organization: ${invalidItems.join(', ')}. Please verify item IDs and try again.`
          );
        }

        const totalAmount = dto.items.reduce((sum: number, item: any) => sum + parseFloat(item.totalPrice), 0);
        const taxAmount = dto.taxAmount ? parseFloat(dto.taxAmount) : 0;
        const shippingCost = dto.shippingCost ? parseFloat(dto.shippingCost) : 0;
        const discountAmount = dto.discountAmount ? parseFloat(dto.discountAmount) : 0;
        const netAmount = totalAmount + taxAmount + shippingCost - discountAmount;

        updateData.totalAmount = totalAmount.toString();
        updateData.netAmount = netAmount.toString();

        // Delete old items and create new ones
        await this.prisma.purchaseOrderItem.deleteMany({ where: { poId: id } });
        updateData.items = {
          create: dto.items.map((item: any) => ({
            itemId: item.itemId,
            quantityOrdered: item.quantityOrdered,
            quantityReceived: 0,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            notes: item.notes || null,
          })),
        };
      }

      const updated = await this.prisma.purchaseOrder.update({
        where: { id },
        data: updateData,
        include: {
          creator: true,
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
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      if (po.status !== POStatus.DRAFT) {
        throw new BadRequestException('Can only delete draft purchase orders');
      }

      await this.prisma.purchaseOrder.delete({
        where: { id },
      });

      return { message: 'Purchase Order deleted successfully' };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async fromPurchaseRequest(
    prId: string,
    dto: any,
    organizationId: string,
    userId: string,
  ): Promise<any> {
    try {
      // Fetch Purchase Request with all items
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id: prId, organizationId },
        include: { items: { include: { item: true } } },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      // Verify PR is in APPROVED status before allowing PO creation
      if (pr.status !== PRStatus.APPROVED) {
        throw new BadRequestException(
          `Can only create PO from approved purchase requests. Current status: ${pr.status}`,
        );
      }

      // Generate PO number
      const lastPO = await this.prisma.purchaseOrder.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      });
      const nextNumber = (lastPO?.poNumber?.split('-')[2] ? parseInt(lastPO.poNumber.split('-')[2]) : 0) + 1;
      const poNumber = `PO-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;

      // Calculate totals from PR items
      const totalAmount = pr.items.reduce(
        (sum, item) => sum + (item.totalPrice ? parseFloat(item.totalPrice.toString()) : 0),
        0,
      );
      const taxAmount = dto.taxAmount ? parseFloat(dto.taxAmount) : 0;
      const shippingCost = dto.shippingCost ? parseFloat(dto.shippingCost) : 0;
      const discountAmount = dto.discountAmount ? parseFloat(dto.discountAmount) : 0;
      const netAmount = totalAmount + taxAmount + shippingCost - discountAmount;

      // Create PO with items in transaction to ensure atomicity
      const po = await this.prisma.$transaction(async (tx) => {
        // Create the purchase order
        const createdPo = await tx.purchaseOrder.create({
          data: {
            poNumber,
            organizationId,
            orderedBy: userId,
            prId: prId,
            expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
            status: POStatus.DRAFT,
            paymentStatus: PaymentStatus.PENDING,
            totalAmount: totalAmount.toString(),
            taxAmount: dto.taxAmount || null,
            shippingCost: dto.shippingCost || null,
            discountAmount: dto.discountAmount || null,
            netAmount: netAmount.toString(),
            notes: dto.notes || null,
            items: {
              create: pr.items.map((item) => ({
                itemId: item.itemId,
                quantityOrdered: item.quantity,
                quantityReceived: 0,
                unitPrice: item.unitPrice?.toString() || '0',
                totalPrice: item.totalPrice?.toString() || '0',
                notes: item.notes,
              })),
            },
          },
          include: {
            creator: true,
            items: { include: { item: true } },
          },
        });

        return createdPo;
      });

      return po;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async submit(id: string, organizationId: string): Promise<any> {
    try {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      if (po.status !== POStatus.DRAFT) {
        throw new BadRequestException('Can only submit draft purchase orders');
      }

      return await this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: POStatus.SUBMITTED },
        include: {
          items: { include: { item: true } },
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async updateStatus(id: string, organizationId: string, status: string): Promise<any> {
    try {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      // Validate the status is a valid POStatus enum value
      const validStatuses = Object.values(POStatus);
      if (!validStatuses.includes(status as POStatus)) {
        throw new BadRequestException(
          `Invalid status: ${status}. Allowed values: ${validStatuses.join(', ')}`
        );
      }

      // Define allowed transitions
      const allowedTransitions: Record<POStatus, POStatus[]> = {
        [POStatus.DRAFT]: [POStatus.SUBMITTED, POStatus.CANCELLED],
        [POStatus.SUBMITTED]: [POStatus.CONFIRMED, POStatus.CANCELLED],
        [POStatus.CONFIRMED]: [POStatus.PARTIALLY_RECEIVED, POStatus.RECEIVED],
        [POStatus.PARTIALLY_RECEIVED]: [POStatus.RECEIVED, POStatus.CANCELLED],
        [POStatus.RECEIVED]: [],
        [POStatus.CANCELLED]: [],
      };

      const currentStatus = po.status as POStatus;
      const targetStatus = status as POStatus;

      if (!allowedTransitions[currentStatus].includes(targetStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${currentStatus} to ${targetStatus}. Allowed: ${allowedTransitions[currentStatus].join(', ')}`
        );
      }

      return await this.prisma.purchaseOrder.update({
        where: { id },
        data: { status: targetStatus as any },
        include: {
          items: { include: { item: true } },
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async updatePaymentStatus(id: string, organizationId: string, paymentStatus: string): Promise<any> {
    try {
      const po = await this.prisma.purchaseOrder.findFirst({
        where: { id, organizationId },
      });

      if (!po) {
        throw new NotFoundException('Purchase Order not found');
      }

      const validStatuses = ['PENDING', 'PAID', 'PARTIAL'];
      if (!validStatuses.includes(paymentStatus)) {
        throw new BadRequestException(`Invalid payment status: ${paymentStatus}`);
      }

      return await this.prisma.purchaseOrder.update({
        where: { id },
        data: { paymentStatus: paymentStatus as any },
        include: {
          items: { include: { item: true } },
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
