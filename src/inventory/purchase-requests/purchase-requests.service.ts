import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { GetPurchaseRequestDto } from './dto/get-purchase-request.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { PRStatus } from 'src/prisma/prisma.types';

@Injectable()
export class PurchaseRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreatePurchaseRequestDto, organizationId: string, userId: string): Promise<any> {
    try {
      // Verify store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: dto.storeId, organizationId },
      });

      if (!store) {
        throw new BadRequestException('Store not found for this organization');
      }

      // Verify all items exist
      const itemIds = dto.items.map(item => item.itemId);
      const items = await this.prisma.item.findMany({
        where: { id: { in: itemIds }, organizationId },
      });

      if (items.length !== itemIds.length) {
        throw new BadRequestException('One or more items do not exist for this organization');
      }

      return await this.prisma.purchaseRequest.create({
        data: {
          organizationId,
          storeId: dto.storeId,
          prNumber: `PR-${Date.now()}`,
          requestDate: new Date(),
          requiredDate: dto.requiredDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          requestedBy: userId,
          notes: dto.notes,
          status: PRStatus.DRAFT,
          items: {
            create: dto.items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : null,
              notes: item.notes,
            })),
          },
        },
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, dto: GetPurchaseRequestDto): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = { organizationId };

      if (dto.storeId) {
        where.storeId = dto.storeId;
      }

      if (dto.status) {
        where.status = dto.status;
      }

      if (dto.search) {
        where.description = { contains: dto.search, mode: 'insensitive' };
      }

      const [data, total] = await Promise.all([
        this.prisma.purchaseRequest.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { store: true, items: { include: { item: true } } },
        }),
        this.prisma.purchaseRequest.count({ where }),
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
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
        include: { store: true, items: { include: { item: true } } },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      return pr;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdatePurchaseRequestDto, organizationId: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      if (pr.status !== PRStatus.DRAFT) {
        throw new BadRequestException('Can only update draft purchase requests');
      }

      const updateData: any = { ...dto };
      delete updateData.storeId;  // Don't allow changing store
      
      return await this.prisma.purchaseRequest.update({
        where: { id },
        data: updateData,
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async approve(id: string, organizationId: string, userId: string, notes?: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      if (pr.status !== PRStatus.SUBMITTED) {
        throw new BadRequestException('Can only approve submitted purchase requests');
      }

      return await this.prisma.purchaseRequest.update({
        where: { id },
        data: { 
          status: PRStatus.APPROVED,
          approvedBy: userId,
          approvalDate: new Date(),
          notes: notes || pr.notes,
        },
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async reject(id: string, organizationId: string, userId: string, reason?: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      if (pr.status !== PRStatus.SUBMITTED) {
        throw new BadRequestException('Can only reject submitted purchase requests');
      }

      return await this.prisma.purchaseRequest.update({
        where: { id },
        data: { 
          status: PRStatus.REJECTED, 
          notes: reason || pr.notes 
        },
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async cancel(id: string, organizationId: string, userId: string, notes?: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      if (![PRStatus.DRAFT, PRStatus.SUBMITTED].includes(pr.status as any)) {
        throw new BadRequestException('Can only cancel draft or submitted purchase requests');
      }

      return await this.prisma.purchaseRequest.update({
        where: { id },
        data: { 
          status: PRStatus.CANCELLED,
          notes: notes || pr.notes,
        },
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async submit(id: string, organizationId: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      if (pr.status !== PRStatus.DRAFT) {
        throw new BadRequestException('Can only submit draft purchase requests');
      }

      return await this.prisma.purchaseRequest.update({
        where: { id },
        data: { status: PRStatus.SUBMITTED },
        include: { store: true, items: { include: { item: true } } },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const pr = await this.prisma.purchaseRequest.findFirst({
        where: { id, organizationId },
      });

      if (!pr) {
        throw new NotFoundException('Purchase Request not found');
      }

      return await this.prisma.purchaseRequest.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
