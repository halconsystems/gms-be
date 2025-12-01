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

  async create(dto: CreatePurchaseRequestDto, organizationId: string, userId: string, isSuperAdmin: boolean = false): Promise<any> {
    try {
      // Log start of create operation
      console.log('[PR Service] Create called with:', {
        organizationId,
        userId,
        isSuperAdmin,
        storeId: dto.storeId,
        itemIds: dto.items.map(i => i.itemId),
        requiredDate: dto.requiredDate
      });

      // Verify organization exists (defensive check)
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      console.log('[PR Service] Organization validation:', { organizationId, found: !!organization });
      if (!organization) {
        throw new BadRequestException('Organization not found');
      }

      // Verify user exists in database
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      console.log('[PR Service] User validation:', { userId, found: !!user });
      if (!user) {
        throw new BadRequestException('User not found or invalid user ID');
      }

      // Verify user belongs to organization (skip for superadmin)
      let userOffice: any = null;
      if (!isSuperAdmin) {
        userOffice = await this.prisma.userOffice.findFirst({
          where: {
            userId,
            organizationId,
          },
        });
        console.log('[PR Service] User-organization membership validation:', { userId, organizationId, found: !!userOffice });
        if (!userOffice) {
          throw new BadRequestException('User does not have access to this organization');
        }
      } else {
        console.log('[PR Service] Skipping user-organization membership check (superadmin):', { userId });
      }

      // Auto-fill storeId if not provided - use user's office store
      let storeId = dto.storeId;
      if (!storeId && userOffice?.officeId) {
        // Get the store associated with user's office
        const office = await this.prisma.office.findUnique({
          where: { id: userOffice.officeId },
          select: { id: true, branchName: true }
        });
        if (office) {
          // Try to find a store for this office/organization
          const stores = await this.prisma.store.findMany({
            where: { organizationId },
            take: 1
          });
          if (stores.length > 0) {
            storeId = stores[0].id;
            console.log('[PR Service] Auto-filled storeId from organization stores:', { storeId });
          }
        }
      }

      if (!storeId) {
        throw new BadRequestException('Store ID not provided and could not be auto-filled from user office');
      }

      // Verify store belongs to organization
      const store = await this.prisma.store.findFirst({
        where: { id: storeId, organizationId },
      });
      console.log('[PR Service] Store validation:', { storeId, found: !!store });
      if (!store) {
        throw new BadRequestException('Store not found for this organization');
      }

      // Verify all items exist
      const itemIds = dto.items.map(item => item.itemId);
      const items = await this.prisma.item.findMany({
        where: { id: { in: itemIds }, organizationId },
      });
      console.log('[PR Service] Items validation:', { requested: itemIds.length, found: items.length });
      if (items.length !== itemIds.length) {
        throw new BadRequestException('One or more items do not exist for this organization');
      }

      // Convert requiredDate to Date object if it's a string
      // Handle YYYY-MM-DD format safely (parse at UTC to avoid timezone shifts)
      let requiredDate: Date;
      if (dto.requiredDate) {
        if (typeof dto.requiredDate === 'string') {
          // Detect YYYY-MM-DD format (date-only, no time)
          const dateOnlyMatch = dto.requiredDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateOnlyMatch) {
            const [, year, month, day] = dateOnlyMatch;
            // Parse at UTC to avoid timezone-based date shifts
            requiredDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
            console.log('[PR Service] Date parsed as UTC date-only:', { input: dto.requiredDate, output: requiredDate.toISOString() });
          } else {
            // Fallback for other date formats
            requiredDate = new Date(dto.requiredDate);
            console.log('[PR Service] Date parsed with fallback:', { input: dto.requiredDate, output: requiredDate.toISOString() });
          }
        } else {
          requiredDate = dto.requiredDate;
          console.log('[PR Service] Date passed as Date object:', { output: requiredDate.toISOString() });
        }
      } else {
        requiredDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        console.log('[PR Service] Date defaulted to 30 days from now:', { output: requiredDate.toISOString() });
      }

      console.log('[PR Service] All validations passed, creating PR...');

      const result = await this.prisma.purchaseRequest.create({
        data: {
          organizationId,
          storeId,
          prNumber: `PR-${Date.now()}`,
          requestDate: new Date(),
          requiredDate,
          requestedBy: userId,
          notes: dto.notes,
          status: PRStatus.DRAFT,
          items: {
            create: dto.items.map(item => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitOfMeasurement: item.unitOfMeasurement,
              unitPrice: item.unitPrice ? parseFloat(item.unitPrice.toString()) : null,
              notes: item.notes,
            })),
          },
        },
        include: { store: true, items: { include: { item: true } } },
      });

      console.log('[PR Service] PR created successfully:', { prId: result.id, prNumber: result.prNumber });
      return result;
    } catch (error) {
      console.error('[PR Service] Error during create:', error);
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
      // Verify approver (user doing the approval) exists
      const approver = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      console.log('[PR Service] Approver validation:', { userId, found: !!approver });
      if (!approver) {
        throw new BadRequestException('Approver user not found or invalid user ID');
      }

      // Verify approver belongs to organization
      const approverMembership = await this.prisma.userOffice.findFirst({
        where: {
          userId,
          organizationId,
        },
      });
      console.log('[PR Service] Approver-organization membership validation:', { userId, organizationId, found: !!approverMembership });
      if (!approverMembership) {
        throw new BadRequestException('Approver does not have access to this organization');
      }

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
      // Verify rejector (user doing the rejection) exists
      const rejector = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      console.log('[PR Service] Rejector validation:', { userId, found: !!rejector });
      if (!rejector) {
        throw new BadRequestException('Rejector user not found or invalid user ID');
      }

      // Verify rejector belongs to organization
      const rejectorMembership = await this.prisma.userOffice.findFirst({
        where: {
          userId,
          organizationId,
        },
      });
      console.log('[PR Service] Rejector-organization membership validation:', { userId, organizationId, found: !!rejectorMembership });
      if (!rejectorMembership) {
        throw new BadRequestException('Rejector does not have access to this organization');
      }

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
