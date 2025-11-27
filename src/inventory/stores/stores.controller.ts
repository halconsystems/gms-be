import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  Put,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoresService } from './stores.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { GetStoreDto } from './dto/get-store.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';

@ApiTags('inventory-stores')
@Controller('inventory/stores')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  /**
   * Create a new store
   */
  @Post()
  @ApiOperation({ summary: 'Create a new store' })
  @ResponseMessage('Store created successfully')
  create(
    @Body() dto: CreateStoreDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.storesService.create(dto, organizationId);
  }

  /**
   * Get all stores with pagination and filtering
   */
  @Get()
  @ApiOperation({ summary: 'Get all stores' })
  @ResponseMessage('Stores fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() dto: GetStoreDto,
  ) {
    return this.storesService.findAll(organizationId, dto);
  }

  /**
   * Get a store by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get store by ID' })
  @ResponseMessage('Store fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.storesService.findOne(id, organizationId);
  }

  /**
   * Update a store
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update a store' })
  @ResponseMessage('Store updated successfully')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.storesService.update(id, dto, organizationId);
  }

  /**
   * Delete a store
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a store' })
  @ResponseMessage('Store deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.storesService.remove(id, organizationId);
  }

  /**
   * Toggle store active status
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle store active status' })
  @ResponseMessage('Store status updated successfully')
  toggleStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.storesService.toggleStatus(id, organizationId);
  }
}
