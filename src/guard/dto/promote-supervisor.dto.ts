import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class PromoteSupervisorDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deploymentTill?: string;
}