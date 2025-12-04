import { Controller, Post, Body, Get, Param, UseGuards, Query, Put, Delete, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { GetPurchaseOrderDto } from './dto/get-purchase-order.dto';
import { ConvertPrToPoDto } from './dto/convert-pr-to-po.dto';

@ApiTags('inventory-purchase-orders')
@Controller('inventory/purchase-orders')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrdersController {
  constructor(private readonly poService: PurchaseOrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new purchase order' })
  @ResponseMessage('Purchase order created successfully')
  create(
    @Body() createPoDto: CreatePurchaseOrderDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    // JWT strategy returns both 'id' and 'userId' for compatibility
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      throw new BadRequestException('User ID not found in JWT token. Please ensure you are properly authenticated.');
    }
    
    return this.poService.create(createPoDto, organizationId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all purchase orders' })
  @ResponseMessage('Purchase orders fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetPurchaseOrderDto,
  ) {
    return this.poService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  @ResponseMessage('Purchase order fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a purchase order' })
  @ResponseMessage('Purchase order updated successfully')
  update(
    @Param('id') id: string,
    @Body() updatePoDto: UpdatePurchaseOrderDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.update(id, updatePoDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase order' })
  @ResponseMessage('Purchase order deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.remove(id, organizationId);
  }

  @Post('from-pr/:prId')
  @ApiOperation({ summary: 'Create and persist purchase order from approved purchase request' })
  @ResponseMessage('Purchase order created successfully from purchase request')
  fromPurchaseRequest(
    @Param('prId') prId: string,
    @Body() convertPrToPoDto: ConvertPrToPoDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.poService.fromPurchaseRequest(prId, convertPrToPoDto, organizationId, userId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit purchase order for approval' })
  @ResponseMessage('Purchase order submitted successfully')
  submit(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.submit(id, organizationId);
  }

  @Post(':id/status')
  @ApiOperation({ summary: 'Update purchase order status' })
  @ResponseMessage('Purchase order status updated successfully')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.updateStatus(id, organizationId, body.status);
  }

  @Post(':id/payment-status')
  @ApiOperation({ summary: 'Update purchase order payment status' })
  @ResponseMessage('Purchase order payment status updated successfully')
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() body: { paymentStatus: string },
    @GetOrganizationId() organizationId: string,
  ) {
    return this.poService.updatePaymentStatus(id, organizationId, body.paymentStatus);
  }
}
