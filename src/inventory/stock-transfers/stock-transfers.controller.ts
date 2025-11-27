import { Controller, Post, Body, Get, Param, UseGuards, Query, Put, Delete, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { StockTransfersService } from './stock-transfers.service';
import { CreateStockTransferDto } from './dto/create-stock-transfer.dto';
import { UpdateStockTransferDto } from './dto/update-stock-transfer.dto';
import { GetStockTransferDto } from './dto/get-stock-transfer.dto';

@ApiTags('inventory-stock-transfers')
@Controller('inventory/stock-transfers')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockTransfersController {
  constructor(private readonly service: StockTransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new stock transfer' })
  @ResponseMessage('Stock transfer created successfully')
  create(
    @Body() createDto: CreateStockTransferDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.service.create(createDto, organizationId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all stock transfers' })
  @ResponseMessage('Stock transfers fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetStockTransferDto,
  ) {
    return this.service.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get stock transfer by ID' })
  @ResponseMessage('Stock transfer fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.service.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a stock transfer' })
  @ResponseMessage('Stock transfer updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateStockTransferDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.service.update(id, updateDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a stock transfer' })
  @ResponseMessage('Stock transfer deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.service.remove(id, organizationId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit stock transfer' })
  @ResponseMessage('Stock transfer submitted successfully')
  submit(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.service.submit(id, organizationId);
  }

  @Post(':id/receive')
  @ApiOperation({ summary: 'Receive stock transfer' })
  @ResponseMessage('Stock transfer received successfully')
  receive(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.service.receive(id, organizationId, userId, body.notes);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel stock transfer' })
  @ResponseMessage('Stock transfer cancelled successfully')
  cancel(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @GetOrganizationId() organizationId: string,
  ) {
    return this.service.cancel(id, organizationId, body.notes);
  }
}
