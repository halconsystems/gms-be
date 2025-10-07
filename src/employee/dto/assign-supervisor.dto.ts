import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignSupervisorDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deploymentTill?: string;
}
