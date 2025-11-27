import { Controller, Get, Post, Body, Param, Put, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { GetCategoryDto } from './dto/get-category.dto';

@ApiTags('inventory-categories')
@Controller('inventory/categories')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new category' })
  @ResponseMessage('Category created successfully')
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.create(createCategoryDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ResponseMessage('Categories fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetCategoryDto,
  ) {
    return this.categoriesService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ResponseMessage('Category fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ResponseMessage('Category updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.update(id, updateCategoryDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a category' })
  @ResponseMessage('Category deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.remove(id, organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle category active status' })
  @ResponseMessage('Category status updated successfully')
  toggleStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.categoriesService.toggleStatus(id, organizationId);
  }
}

