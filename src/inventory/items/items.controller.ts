import { Controller, Post, Body, Get, Param, Put, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { GetItemDto } from './dto/get-item.dto';

@ApiTags('inventory-items')
@Controller('inventory/items')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ResponseMessage('Item created successfully')
  create(
    @Body() createItemDto: CreateItemDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.create(createItemDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all items' })
  @ResponseMessage('Items fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetItemDto,
  ) {
    return this.itemsService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get item by ID' })
  @ResponseMessage('Item fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an item' })
  @ResponseMessage('Item updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.update(id, updateItemDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an item' })
  @ResponseMessage('Item deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.remove(id, organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle item active status' })
  @ResponseMessage('Item status updated successfully')
  toggleStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.toggleStatus(id, organizationId);
  }

  @Get(':id/inventory')
  @ApiOperation({ summary: 'Get stock levels for an item across all stores' })
  @ResponseMessage('Item stock levels fetched successfully')
  getStockLevels(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.itemsService.getStockLevels(id, organizationId);
  }
}
