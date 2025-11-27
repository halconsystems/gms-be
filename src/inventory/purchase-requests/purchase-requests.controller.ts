import { Controller, Post, Body, Get, Param, Put, Delete, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { PurchaseRequestsService } from './purchase-requests.service';
import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto';
import { UpdatePurchaseRequestDto } from './dto/update-purchase-request.dto';
import { GetPurchaseRequestDto } from './dto/get-purchase-request.dto';
import { ApprovePurchaseRequestDto } from './dto/approve-purchase-request.dto';

@ApiTags('inventory-purchase-requests')
@Controller('inventory/purchase-requests')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseRequestsController {
  constructor(private readonly prService: PurchaseRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new purchase request' })
  @ResponseMessage('Purchase request created successfully')
  create(
    @Body() createPrDto: CreatePurchaseRequestDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.prService.create(createPrDto, organizationId, userId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all purchase requests' })
  @ResponseMessage('Purchase requests fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetPurchaseRequestDto,
  ) {
    return this.prService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get purchase request by ID' })
  @ResponseMessage('Purchase request fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.prService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a purchase request' })
  @ResponseMessage('Purchase request updated successfully')
  update(
    @Param('id') id: string,
    @Body() updatePrDto: UpdatePurchaseRequestDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.prService.update(id, updatePrDto, organizationId);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit purchase request for approval' })
  @ResponseMessage('Purchase request submitted successfully')
  submit(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.prService.submit(id, organizationId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve purchase request' })
  @ResponseMessage('Purchase request approved successfully')
  approve(
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseRequestDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.prService.approve(id, organizationId, userId, dto.notes);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject purchase request' })
  @ResponseMessage('Purchase request rejected successfully')
  reject(
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseRequestDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.prService.reject(id, organizationId, userId, dto.notes);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel purchase request' })
  @ResponseMessage('Purchase request cancelled successfully')
  cancel(
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseRequestDto,
    @GetOrganizationId() organizationId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || organizationId;
    return this.prService.cancel(id, organizationId, userId, dto.notes);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a purchase request' })
  @ResponseMessage('Purchase request deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.prService.remove(id, organizationId);
  }
}
