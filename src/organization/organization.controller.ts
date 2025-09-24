import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from 'src/common/guards/role-guard';

import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { CreateOfficeDto } from './dto/create-office-dto';
import { CreateOrganizationBankAccountDto } from './dto/create-bank-account.dto';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post('register')
  @ResponseMessage('Organization registered successfully')
  async create(@Body() dto: CreateOrganizationDto) {
    try {
      console.log('Creating organization with data:', {
        ...dto,
        password: '[REDACTED]'
      });
      
      const result = await this.organizationService.create(dto);
      
      console.log('Organization created successfully:', {
        organizationId: result.data.id,
        userId: result.data.userId
      });
      
      return result;
    } catch (error) {
      console.error('Organization creation failed:', error);
      throw error;
    }
  }

  @Get()
  @Roles(RolesEnum.superAdmin)
  findAll() {
    return this.organizationService.findAll();
  }

  @Post('add-office')
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Office created successfully')
  addOffice(@Body() dto: CreateOfficeDto, @GetOrganizationId() organizationId: string) {
    return this.organizationService.addOffice(dto, organizationId);
  }

  @Post('add/bank-account')
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Bank Account added successfully')
  addBankAccount(
    @Body() dto: CreateOrganizationBankAccountDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.organizationService.addBankAccount(dto, organizationId);
  }

  @Get('get-offices')
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Offices fetched successfully')
  getOffices(@GetOrganizationId() organizationId: string) {
    return this.organizationService.getOffices(organizationId);
  }

  @Get('get/all/bank-accounts')
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Bank Accounts fetched successfully')
  getAllBankAccounts(@GetOrganizationId() organizationId: string) {
    return this.organizationService.getAllBankAccounts(organizationId);
  }

  @Delete('delete-office/:id')
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Office deleted successfully')
  deleteOffice(@Param('id') id: string, @GetOrganizationId() organizationId: string) {
    return this.organizationService.deleteOffice(id, organizationId);
  }

  @Get(':id')
  @Roles(RolesEnum.superAdmin)
  findOne(@Param('id') id: string) {
    return this.organizationService.findOne(id);
  }

  @Patch(':id')
  @Roles(RolesEnum.superAdmin)
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RolesEnum.superAdmin)
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }
}
