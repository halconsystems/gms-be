import { Controller, Post, Body, Get, Param, UseGuards, Query, Req, Put, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { GrnService } from './grn.service';
import { CreateGrnDto } from './dto/create-grn.dto';
import { UpdateGrnDto } from './dto/update-grn.dto';
import { GetGrnDto } from './dto/get-grn.dto';
import { ReceiveGrnDto } from './dto/receive-grn.dto';

@ApiTags('inventory-grn')
@Controller('inventory/grn')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GrnController {
  constructor(private readonly grnService: GrnService) {}

  @Post()
  create(@Body() dto: CreateGrnDto, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.grnService.create(dto, organizationId, userId);
  }

  @Get()
  findAll(@GetOrganizationId() organizationId: string, @Query() query: GetGrnDto) {
    return this.grnService.findAll(organizationId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.grnService.findOne(id, organizationId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGrnDto, @GetOrganizationId() organizationId: string) {
    return this.grnService.update(id, dto, organizationId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.grnService.remove(id, organizationId);
  }

  @Post(':id/inspect')
  setInspecting(@Param('id') id: string, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.grnService.setInspecting(id, organizationId, userId);
  }

  @Post(':id/receive')
  receiveGoods(@Param('id') id: string, @Body() dto: ReceiveGrnDto, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.grnService.receiveGoods(id, dto, organizationId, userId);
  }
}
