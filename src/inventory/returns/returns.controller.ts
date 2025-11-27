import { Controller, Post, Body, Get, Param, UseGuards, Query, Delete, Put, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { ReturnsService } from './returns.service';
import { GetReturnsDto } from './dto/get-returns.dto';

@ApiTags('inventory-returns')
@Controller('inventory/returns')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Post()
  create(@Body() dto: any, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.service.create(dto, organizationId, userId);
  }

  @Get()
  findAll(@GetOrganizationId() organizationId: string, @Query() query: GetReturnsDto) {
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
}

