import { Controller, Post, Body, Get, Param, UseGuards, Query, Delete, Put, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { InventoryCardsService } from './inventory-cards.service';
import { GetInventoryCardsDto } from './dto/get-inventory-cards.dto';

@ApiTags('inventory-cards')
@Controller('inventory/inventory-cards')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryCardsController {
  constructor(private readonly service: InventoryCardsService) {}

  @Post()
  create(@Body() dto: any, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.service.create(dto, organizationId, userId);
  }

  @Get()
  findAll(@GetOrganizationId() organizationId: string, @Query() query: GetInventoryCardsDto) {
    return this.service.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.service.findOne(id, organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any, @GetOrganizationId() organizationId: string) {
    return this.service.update(id, dto, organizationId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.service.delete(id, organizationId);
  }

  @Post(':id/return')
  markAsReturned(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.service.markAsReturned(id, organizationId);
  }
}

