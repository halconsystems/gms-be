import { Controller, Post, Body, Get, Param, UseGuards, Query, Delete, Put, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { IssuancesService } from './issuances.service';
import { GetIssuancesDto } from './dto/get-issuances.dto';

@ApiTags('inventory-issuances')
@Controller('inventory/issuances')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IssuancesController {
  constructor(private readonly service: IssuancesService) {}

  @Post()
  create(@Body() dto: any, @GetOrganizationId() organizationId: string, @Req() req: any) {
    const userId = req.user?.id || organizationId;
    return this.service.create(dto, organizationId, userId);
  }

  @Get()
  findAll(@GetOrganizationId() organizationId: string, @Query() query: GetIssuancesDto) {
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

