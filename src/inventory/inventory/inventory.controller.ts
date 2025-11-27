import { Controller, Get, Param, UseGuards, Query, Post, Body, Put, Delete, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { GetInventoryDto } from './dto/get-inventory.dto';

@ApiTags('inventory')
@Controller('inventory/inventory')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create new inventory record' })
  @ResponseMessage('Inventory record created successfully')
  create(
    @Body() createDto: CreateInventoryDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.create(createDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all inventory records' })
  @ResponseMessage('Inventory records fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetInventoryDto,
  ) {
    return this.inventoryService.findAll(organizationId, query);
  }

  @Get('stock-levels/:storeId')
  @ApiOperation({ summary: 'Get all stock levels for a store' })
  @ResponseMessage('Stock levels fetched successfully')
  getStockLevels(
    @Param('storeId') storeId: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.getStockLevelsForStore(organizationId, storeId);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock items' })
  @ResponseMessage('Low stock items fetched successfully')
  getLowStock(
    @GetOrganizationId() organizationId: string,
    @Query('storeId') storeId?: string,
  ) {
    return this.inventoryService.getLowStock(organizationId, storeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inventory record by ID' })
  @ResponseMessage('Inventory record fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.findOne(id, organizationId);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'Get inventory movement history' })
  @ResponseMessage('Inventory movements fetched successfully')
  getMovements(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    // TODO: Implement when StockMovement service is ready
    return this.inventoryService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update inventory record' })
  @ResponseMessage('Inventory record updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.update(id, updateDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete inventory record' })
  @ResponseMessage('Inventory record deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.remove(id, organizationId);
  }

  @Get('store/:storeId/item/:itemId')
  @ApiOperation({ summary: 'Get inventory for store and item' })
  @ResponseMessage('Inventory fetched successfully')
  getByStoreAndItem(
    @Param('storeId') storeId: string,
    @Param('itemId') itemId: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.inventoryService.getByStoreAndItem(storeId, itemId, organizationId);
  }
}
