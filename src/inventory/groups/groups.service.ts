import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GetGroupDto } from './dto/get-group.dto';
import { PaginatedResponse } from '../common/interfaces/prisma.types';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGroupDto, organizationId: string): Promise<any> {
    try {
      return await this.prisma.itemGroup.create({
        data: {
          organizationId,
          name: dto.name,
          description: dto.description,
          categoryId: dto.categoryId,
          isActive: true,
        },
        include: { category: true, items: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findAll(organizationId: string, dto: GetGroupDto): Promise<PaginatedResponse<any>> {
    try {
      const skip = ((dto.page || 1) - 1) * (dto.limit || 10);
      const take = dto.limit || 10;

      const where: any = { organizationId };

      if (dto.categoryId) {
        where.categoryId = dto.categoryId;
      }

      if (dto.isActive !== undefined) {
        where.isActive = dto.isActive;
      }

      if (dto.search) {
        where.OR = [{ name: { contains: dto.search, mode: 'insensitive' } }];
      }

      const [data, total] = await Promise.all([
        this.prisma.itemGroup.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { category: true, items: true },
        }),
        this.prisma.itemGroup.count({ where }),
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
      const group = await this.prisma.itemGroup.findFirst({
        where: { id, organizationId },
        include: { category: true, items: true },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return group;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateGroupDto, organizationId: string): Promise<any> {
    try {
      const group = await this.prisma.itemGroup.findFirst({
        where: { id, organizationId },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return await this.prisma.itemGroup.update({
        where: { id },
        data: dto,
        include: { category: true, items: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async remove(id: string, organizationId: string): Promise<any> {
    try {
      const group = await this.prisma.itemGroup.findFirst({
        where: { id, organizationId },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return await this.prisma.itemGroup.delete({ where: { id } });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async toggleStatus(id: string, organizationId: string): Promise<any> {
    try {
      const group = await this.prisma.itemGroup.findFirst({
        where: { id, organizationId },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      return await this.prisma.itemGroup.update({
        where: { id },
        data: { isActive: !group.isActive },
        include: { category: true, items: true },
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}
