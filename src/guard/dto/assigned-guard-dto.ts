import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AssignGuardDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  requestedGuardId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  locationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  guardCategoryId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  guardId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  serviceNumber?: number;
}
