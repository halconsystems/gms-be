import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateEmployeeUserDto } from './dto/create-employee-user.dto';
import { CreateServiceNumberUserDto } from './dto/create-service-number-user.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { Roles } from 'src/common/decorators/role.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { RolesEnum } from 'src/common/enums/roles-enum';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('User created successfully')
  create(
    @Body() createUserDto: CreateUserDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.userService.create(createUserDto, organizationId);
  }

  @Post('/create')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('User created successfully')
  createEmployeeUser(
    @Body() createEmployeeUserDto: CreateEmployeeUserDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.userService.createEmployeeUser(
      createEmployeeUserDto,
      organizationId,
    );
  }

  @Post('/create-by-service-number')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ApiOperation({
    summary: 'Create user by service number for employee or guard',
  })
  @ResponseMessage('User created successfully')
  createServiceNumberUser(
    @Body() createServiceNumberUserDto: CreateServiceNumberUserDto,
    @GetOrganizationId() organizationId: string,
  ) {
    return this.userService.createServiceNumberUser(
      createServiceNumberUserDto,
      organizationId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ResponseMessage('Users fetched successfully')
  findAll() {
    return this.userService.findAll();
  }

  @Get('me/client')
  @ApiOperation({ summary: 'Get authenticated user\'s client information' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.client)
  @ResponseMessage('Client information fetched successfully')
  async getMyClient(@Req() req) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.userService.getClientByUserId(userId);
  }

  @Get('supervisors')
  @ApiOperation({ summary: 'Get all supervisors' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ResponseMessage('Supervisors fetched successfully')
  async getSupervisors(
    @GetOrganizationId() organizationId: string,
    @Query('locationId') locationId?: string,
    @Query('clientId') clientId?: string,
  ) {
    const supervisors = await this.userService.getSupervisors(organizationId, {
      locationId,
      clientId,
    });
    // Return directly without wrapping, as @ResponseMessage will handle the wrapping
    return supervisors;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ResponseMessage('User fetched successfully')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.superAdmin)
  @ResponseMessage('User deleted successfully')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
