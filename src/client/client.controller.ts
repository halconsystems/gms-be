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
  ConflictException,
  BadRequestException,
  Query,
  ForbiddenException,
  ParseIntPipe,
  DefaultValuePipe,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { RolesEnum } from 'src/common/enums/roles-enum';

import { ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Client')
@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Client created successfully')
  async create(
    @Body() createClientDto: CreateClientDto,
    @GetOrganizationId() organizationId: string,
  ) {
    try {
      const result = await this.clientService.create(
        createClientDto,
        organizationId,
      );
      return {
        success: true,
        data: result,
        message: 'Client created successfully',
      };
    } catch (error) {
      console.error('Error in client creation:', error);

      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error.message.includes('Numeric overflow') ||
        error.message.includes('too large')
      ) {
        throw new BadRequestException(
          'Contract number is too large. Please use a smaller number.',
        );
      }

      // Log detailed error for debugging
      console.error('Detailed error:', JSON.stringify(error, null, 2));

      // Handle any Prisma-specific errors
      if (error.code) {
        handlePrismaError(error);
      }

      throw new BadRequestException(
        error.message ||
          'Failed to create client. Please check your input and try again.',
      );
    }
  }

  @Get()
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('All clients fetched successfully')
  findAll() {
    return this.clientService.findAll();
  }

  @Get('/by-organization')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Client fetched successfully')
  findAllByOrganizationId(@GetOrganizationId() organizationId: string, @Req() req) {
    return this.clientService.findClientByOrganizationId(
      organizationId,
      req.user,
    );
  }

  @Get('search')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Clients fetched successfully')
  searchClients(
    @Query('query') query: string,
    @GetOrganizationId() organizationId: string,
    @Req() req
  ) {
    return this.clientService.searchClients(query, organizationId, req.user);
  }

  @Get(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Client fetched successfully')
  findOne(@Param('id') id: string) {
    return this.clientService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Client updated successfully')
  update(@Param('id') id: string, @Body() UpdateClientDto: UpdateClientDto) {
    return this.clientService.update(id, UpdateClientDto);
  }

  @Delete(':id')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin, RolesEnum.manager)
  @ResponseMessage('Client deleted successfully')
  remove(@Param('id') id: string) {
    return this.clientService.remove(id);
  }

  @Get(':id/summary')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.client)
  @ResponseMessage('Client summary fetched successfully')
  @ApiResponse({ status: 200, description: 'Client summary fetched successfully' })
  async getClientSummary(
    @Param('id') id: string,
    @Req() req,
  ) {
    this.logger.log('getClientSummary request user:', req.user);
    
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    try {
      const authenticatedClientId = await this.clientService.getClientIdByUserId(userId);
      
      if (id !== authenticatedClientId) {
        throw new ForbiddenException({
          message: 'Not authorized to access this client data',
          requestedClientId: id,
          authenticatedClientId
        });
      }
      return this.clientService.getClientSummary(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Client association missing');
      }
      throw error;
    }
  }

  @Get(':id/assigned-guards')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.client)
  @ResponseMessage('Assigned guards fetched successfully')
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Assigned guards fetched successfully' })
  async getAssignedGuards(
    @Param('id') id: string,
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('locationId') locationId?: string,
  ) {
    this.logger.log('getAssignedGuards request user:', req.user);
    
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    
    try {
      const authenticatedClientId = await this.clientService.getClientIdByUserId(userId);
      
      if (id !== authenticatedClientId) {
        throw new ForbiddenException({
          message: 'Not authorized to access this client data',
          requestedClientId: id,
          authenticatedClientId
        });
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('Client association missing');
      }
      throw error;
    }
    page = Math.max(1, page);
    limit = Math.min(100, Math.max(1, limit));
    return this.clientService.getAssignedGuards(id, locationId, page, limit);
  }

  private readonly logger = new Logger(ClientController.name);

  @Get(':id/locations')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.client)
  @ResponseMessage('Client locations fetched successfully')
  @ApiResponse({ status: 200, description: 'Client locations fetched successfully' })
  async getClientLocations(
    @Param('id') id: string,
    @Req() req,
  ) {
    this.logger.log(`Fetching locations for client ${id}`);

    try {
      // Early UUID format validation
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_REGEX.test(id)) {
        this.logger.warn(`Invalid UUID format in request: ${id}`);
        throw new BadRequestException('Invalid client ID format');
      }

      const userId = req.user?.userId || req.user?.id || req.user?.sub;
      this.logger.debug(`User ID extracted from request: ${userId}`);

      try {
        const authenticatedClientId = await this.clientService.getClientIdByUserId(userId);
        this.logger.debug(`Authenticated client ID: ${authenticatedClientId}`);
        
        if (id !== authenticatedClientId) {
          this.logger.warn(`Unauthorized access attempt - Request ID: ${id}, Authenticated ID: ${authenticatedClientId}`);
          throw new ForbiddenException({
            message: 'Not authorized to access this client data',
            requestedClientId: id,
            authenticatedClientId
          });
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          this.logger.warn(`No client association found for user: ${userId}`);
          throw new UnauthorizedException('Client association missing');
        }
        throw error;
      }

      const result = await this.clientService.getClientLocations(id);
      this.logger.log(`Successfully retrieved ${result.data.length} locations for client ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching locations for client ${id}:`, error.stack);
      throw error; // Re-throw to maintain error handling chain
    }
  }

  @Get(':id/attendance')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.client)
  @ResponseMessage('Client attendance data fetched successfully')
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page' })
  @ApiResponse({ status: 200, description: 'Client attendance data fetched successfully' })
  async getClientAttendance(
    @Param('id') id: string,
    @Req() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('locationId') locationId?: string,
  ) {
    this.logger.log(`Fetching attendance for client ${id}`);
    this.logger.log('getClientAttendance request user:', req.user);
    
    try {
      const userId = req.user?.userId || req.user?.id || req.user?.sub;
      this.logger.debug(`User ID extracted from request: ${userId}`);

      try {
        const authenticatedClientId = await this.clientService.getClientIdByUserId(userId);
        this.logger.debug(`Authenticated client ID: ${authenticatedClientId}`);
        
        if (id !== authenticatedClientId) {
          this.logger.warn(`Unauthorized access attempt - Request ID: ${id}, Authenticated ID: ${authenticatedClientId}`);
          throw new ForbiddenException({
            message: 'Not authorized to access this client data',
            requestedClientId: id,
            authenticatedClientId
          });
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          this.logger.warn('Client association missing for user:', userId);
          throw new UnauthorizedException('Client association missing');
        }
        throw error;
      }

      page = Math.max(1, page);
      limit = Math.min(100, Math.max(1, limit));
      this.logger.debug(`Pagination parameters: page=${page}, limit=${limit}`);
      this.logger.debug(`Filter parameters: dateFrom=${dateFrom}, dateTo=${dateTo}, locationId=${locationId}`);

      const result = await this.clientService.getClientAttendance(id, dateFrom, dateTo, locationId, page, limit);
      this.logger.log(`Successfully retrieved ${result.data.length} attendance records for client ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error fetching attendance for client ${id}:`, error.stack);
      throw error; // Re-throw to maintain error handling chain
    }
  }
}
