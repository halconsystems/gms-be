import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { GetVendorDto } from './dto/get-vendor.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class VendorsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateVendorDto, organizationId: string): Promise<any> {
    try {
      // Validate rating bounds
      if (dto.rating !== undefined && (dto.rating < 0 || dto.rating > 5)) {
        throw new BadRequestException('Vendor rating must be between 0 and 5');
      }

      return await this.prisma.vendor.create({
        data: {
          organizationId,
          name: dto.name,
          contactPerson: dto.contactPerson,
          email: dto.email,
          phone: dto.phone,
          phoneSecondary: dto.phoneSecondary,
          address: dto.address,
          city: dto.city,
          country: dto.country,
          paymentTerms: dto.paymentTerms,
          rating: dto.rating ? parseFloat(dto.rating.toString()) : null,
          isActive: true,
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, dto: GetVendorDto): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = { organizationId };

      if (dto.isActive !== undefined) {
        where.isActive = dto.isActive;
      }

      if (dto.city) {
        where.city = { contains: dto.city, mode: 'insensitive' };
      }

      if (dto.country) {
        where.country = { contains: dto.country, mode: 'insensitive' };
      }

      if (dto.search) {
        where.OR = [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { contactPerson: { contains: dto.search, mode: 'insensitive' } },
          { email: { contains: dto.search, mode: 'insensitive' } },
        ];
      }

      const [data, total] = await Promise.all([
        this.prisma.vendor.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.vendor.count({ where }),
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
      const vendor = await this.prisma.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      return vendor;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateVendorDto, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      // Validate rating bounds if provided
      if (dto.rating !== undefined && (dto.rating < 0 || dto.rating > 5)) {
        throw new BadRequestException('Vendor rating must be between 0 and 5');
      }

      return await this.prisma.vendor.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      return await this.prisma.vendor.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async toggleStatus(id: string, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      return await this.prisma.vendor.update({
        where: { id },
        data: { isActive: !vendor.isActive },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getVendorItems(vendorId: string, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: vendorId, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const items = await this.prisma.item.findMany({
        where: {
          organizationId,
          preferredVendorId: vendorId,
        },
        include: { category: true, group: true },
      });

      return { vendor, items, itemCount: items.length };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getVendorPurchaseHistory(vendorId: string, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: vendorId, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const purchaseOrders = await this.prisma.purchaseOrder.findMany({
        where: {
          organizationId,
        },
        include: { items: true, creator: true },
        orderBy: { createdAt: 'desc' },
      });

      const totalOrders = purchaseOrders.length;
      const totalAmount = purchaseOrders.reduce((sum, po) => sum + (parseFloat(po.netAmount?.toString() || '0')), 0);

      return {
        vendor,
        purchaseOrders,
        summary: {
          totalOrders,
          totalAmount,
          averageOrderAmount: totalOrders > 0 ? totalAmount / totalOrders : 0,
        },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async getVendorGrns(vendorId: string, organizationId: string): Promise<any> {
    try {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: vendorId, organizationId },
      });

      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const grns = await this.prisma.grn.findMany({
        where: {
          organizationId,
          vendorId,
        },
        include: {
          items: { include: { item: true } },
          purchaseOrder: true,
          store: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalGrns = grns.length;
      const totalQuantity = grns.reduce((sum, grn) => sum + (grn.totalQuantity || 0), 0);
      const totalAmount = grns.reduce((sum, grn) => sum + (parseFloat(grn.totalAmount?.toString() || '0')), 0);

      return {
        vendor,
        grns,
        summary: {
          totalGrns,
          totalQuantity,
          totalAmount,
          averageGrnAmount: totalGrns > 0 ? totalAmount / totalGrns : 0,
        },
      };
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
