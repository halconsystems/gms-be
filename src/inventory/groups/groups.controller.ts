import { Controller, Post, Body, Get, Param, Put, Delete, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GetGroupDto } from './dto/get-group.dto';

@ApiTags('inventory-groups')
@Controller('inventory/groups')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  @ResponseMessage('Group created successfully')
  create(
    @Body() createGroupDto: CreateGroupDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.groupsService.create(createGroupDto, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all groups' })
  @ResponseMessage('Groups fetched successfully')
  findAll(
    @GetOrganizationId() organizationId: string,
    @Query() query: GetGroupDto,
  ) {
    return this.groupsService.findAll(organizationId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get group by ID' })
  @ResponseMessage('Group fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.groupsService.findOne(id, organizationId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a group' })
  @ResponseMessage('Group updated successfully')
  update(
    @Param('id') id: string,
    @Body() updateGroupDto: UpdateGroupDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.groupsService.update(id, updateGroupDto, organizationId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a group' })
  @ResponseMessage('Group deleted successfully')
  remove(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.groupsService.remove(id, organizationId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle group active status' })
  @ResponseMessage('Group status updated successfully')
  toggleStatus(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.groupsService.toggleStatus(id, organizationId);
  }
}
