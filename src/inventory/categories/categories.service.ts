import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoryDto } from './dto/get-category.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCategoryDto, organizationId: string): Promise<any> {
    try {
      return await this.prisma.itemCategory.create({
        data: {
          organizationId,
          name: dto.name,
          description: dto.description,
          isActive: true,
        },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, dto: GetCategoryDto): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = { organizationId };

      if (dto.isActive !== undefined) {
        where.isActive = dto.isActive;
      }

      if (dto.search) {
        where.OR = [{ name: { contains: dto.search, mode: 'insensitive' } }];
      }

      const [data, total] = await Promise.all([
        this.prisma.itemCategory.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { groups: true, items: true },
        }),
        this.prisma.itemCategory.count({ where }),
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
      const category = await this.prisma.itemCategory.findFirst({
        where: { id, organizationId },
        include: { groups: true, items: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto, organizationId: string): Promise<any> {
    try {
      const category = await this.prisma.itemCategory.findFirst({
        where: { id, organizationId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return await this.prisma.itemCategory.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const category = await this.prisma.itemCategory.findFirst({
        where: { id, organizationId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return await this.prisma.itemCategory.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async toggleStatus(id: string, organizationId: string): Promise<any> {
    try {
      const category = await this.prisma.itemCategory.findFirst({
        where: { id, organizationId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return await this.prisma.itemCategory.update({
        where: { id },
        data: { isActive: !category.isActive },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
