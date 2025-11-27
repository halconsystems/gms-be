import { Controller, Post, Body, Get, Param, Put, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { GetVendorDto } from './dto/get-vendor.dto';

@ApiTags('inventory-vendors')
@Controller('inventory/vendors')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new vendor' })
  @ResponseMessage('Vendor created successfully')
  create(
    @Body() createVendorDto: CreateVendorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.create(createVendorDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vendors' })
  @ResponseMessage('Vendors fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetVendorDto,
  ) {
    return this.vendorsService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get vendor by ID' })
  @ResponseMessage('Vendor fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vendor' })
  @ResponseMessage('Vendor updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateVendorDto: UpdateVendorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.update(id, updateVendorDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vendor' })
  @ResponseMessage('Vendor deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.remove(id, organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle vendor active status' })
  @ResponseMessage('Vendor status updated successfully')
  toggleStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.toggleStatus(id, organizationId);
  }

  @Get(':id/purchase-orders')
  @ApiOperation({ summary: 'Get purchase order history for a vendor' })
  @ResponseMessage('Vendor purchase order history fetched successfully')
  getVendorPurchaseHistory(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.getVendorPurchaseHistory(id, organizationId);
  }

  @Get(':id/grns')
  @ApiOperation({ summary: 'Get GRN history for a vendor' })
  @ResponseMessage('Vendor GRN history fetched successfully')
  getVendorGrns(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.vendorsService.getVendorGrns(id, organizationId);
  }
}
