import { Controller, Get, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { StockMovementsService } from './stock-movements.service';

@ApiTags('inventory-stock-movements')
@Controller('inventory/stock-movements')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all stock movements' })
  @ResponseMessage('Stock movements fetched successfully')
  findAll(@GetOrganizationId() organizationId: string, @Query() query: any) {
    return this.service.findAll(organizationId, query);
  }

  @Get('report')
  @ApiOperation({ summary: 'Get stock movement report with aggregates' })
  @ResponseMessage('Stock movement report fetched successfully')
  getReport(@GetOrganizationId() organizationId: string, @Query() query: any) {
    return this.service.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock movement by ID' })
  @ResponseMessage('Stock movement fetched successfully')
  findOne(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.service.findOne(id, organizationId);
  }
}
