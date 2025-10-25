// ...existing code...
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { GuardService } from './guard.service';
import { CreateGuardDto } from './dto/create-guard-dto';
import { UpdateGuardDto } from './dto/update-guard-dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { AssignGuardDto } from './dto/assigned-guard-dto';
import { AssignSupervisorDto } from '../employee/dto/assign-supervisor.dto';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { PromoteSupervisorDto } from './dto/promote-supervisor.dto';

@ApiTags('Guards')
@Controller('guards')
export class GuardController {
  constructor(private readonly guardService: GuardService) {}

  @Post('bulk-upload')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guards uploaded successfully')
  async bulkUpload(
    @GetOrganizationId() organizationId: string,
    @Body() body: { officeId: string; guards: any[] },
  ) {
    const result = await this.guardService.bulkUploadGuards(
      organizationId,
      body.officeId,
      body.guards,
    );
    if (!result.success) {
      throw new BadRequestException({
        message: result.message || 'Validation failed',
        errors: result.errors || [],
      });
    }
    return result;
  }

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard created successfully')
  create(
    @Body() createGuardDto: CreateGuardDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.guardService.create(createGuardDto, organizationId);
  }

  // @Get()
  // findAll() {
  //   return this.guardService.findAll();
  // }

  @Get('/by-organization')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard fetched successfully')
  findAllByOrganizationId(@GetOrganizationId() organizationId: string) {
    return this.guardService.findGuardsByOrganizationId(organizationId);
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard fetched successfully')
  findOne(
    @Param('id') id: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.guardService.findOne(id, organizationId);
  }

  @Get('/by/serviceNumber/')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard fetched successfully')
  findByServiceNumber(
    @Query('serviceNumber', ParseIntPipe) serviceNumber: number,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.guardService.findByServiceNumber(serviceNumber, organizationId);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard updated successfully')
  update(@Param('id') id: string, @Body() updateGuardDto: UpdateGuardDto) {
    return this.guardService.update(id, updateGuardDto);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard deleted successfully')
  remove(@Param('id') id: string) {
    return this.guardService.remove(id);
  }

  //#region : ASSIGN GUARD
  /**
   * Legacy route for backward compatibility - promotes guard to supervisor by ID
   */
  @Post('promote-to-supervisor/:guardId')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Guard promoted to supervisor successfully')
  async promoteGuardToSupervisorLegacy(
    @Param('guardId') guardId: string,
    @Body() dto: PromoteSupervisorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.guardService.promoteGuardToSupervisor(
      guardId,
      undefined,
      dto,
      organizationId,
    );
  }

  /**
   * Promote a guard to supervisor by either ID or service number
   */
  @Post('promote-to-supervisor')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Guard promoted to supervisor successfully')
  async promoteGuardToSupervisor(
    @Query('guardId') guardId: string | undefined,
    @Query('serviceNumber') serviceNumberRaw: string | undefined,
    @Query('personType') personType: 'guard' | 'employee' | undefined,
    @Body() dto: PromoteSupervisorDto,
    @GetOrganizationId() organizationId: string,
  ) {
    // Validate that either guardId or serviceNumber is provided
    if (!guardId && !serviceNumberRaw) {
      throw new BadRequestException(
        'Either guardId or serviceNumber must be provided',
      );
    }

    let serviceNumber: number | undefined;
    if (serviceNumberRaw) {
      const parsedNumber = Number(serviceNumberRaw);
      if (!Number.isInteger(parsedNumber)) {
        throw new BadRequestException('Service number must be a valid integer');
      }
      serviceNumber = parsedNumber;
    }

    return this.guardService.promoteGuardToSupervisor(
      guardId,
      serviceNumber,
      dto,
      organizationId,
      personType,
    );
  }

  /**
   * Assign a guard to a location using either guardId or serviceNumber
   */
  @Post('assign-guard')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Guard assigned successfully')
  assignGuardToLocation(
    @Body() dto: AssignGuardDto,
    @GetOrganizationId() organizationId: string,
  ) {
    // Validate that either guardId or serviceNumber is provided
    if (!dto.guardId && !dto.serviceNumber) {
      throw new BadRequestException(
        'Either guardId or serviceNumber must be provided',
      );
    }
    return this.guardService.assignGuard(dto, organizationId);
  }

  /**
   * Get assigned guard details by ID or service number
   */
  @Get('assigned-guard')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('organizationAdmin')
  @ResponseMessage('Assigned Guard fetched successfully')
  getAssignedGuardByGuardId(
    @GetOrganizationId() organizationId: string,
    @Query('guardId') guardId: string | undefined,
    @Query('serviceNumber', ParseIntPipe) serviceNumber?: number,
  ) {
    // Look up guard by service number if provided, otherwise use ID
    if (serviceNumber !== undefined) {
      return this.guardService.getAssignedGuardByServiceNumber(
        serviceNumber,
        organizationId,
      );
    } else if (guardId) {
      return this.guardService.getAssignedGuardByGuardId(
        guardId,
        organizationId,
      );
    } else {
      throw new BadRequestException(
        'Either guardId or serviceNumber must be provided',
      );
    }
  }

  //# SPECIAL APIS
  @Get('with/assigned-locations')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Guards fetched successfully')
  findGuardsWithAssignedLocations(@GetOrganizationId() organizationId: string) {
    return this.guardService.findGuardsWithAssignedLocations(organizationId);
  }
  //#endregion
}
