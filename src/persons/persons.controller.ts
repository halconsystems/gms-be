import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-guard';
import { RolesGuard } from 'src/common/guards/role-guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { RolesEnum } from 'src/common/enums/roles-enum';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { GetOrganizationId } from 'src/common/decorators/get-organization-Id.decorator';
import { PersonsService } from './persons.service';

@ApiTags('persons')
@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get('search')
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolesEnum.organizationAdmin)
  @ApiOperation({ summary: 'Search persons by service number or name' })
  @ResponseMessage('Persons fetched successfully')
  async searchPersons(
    @Query('search') search: string,
    @GetOrganizationId() organizationId: string,
  ) {
    return await this.personsService.searchPersons(search, organizationId);
  }
}
