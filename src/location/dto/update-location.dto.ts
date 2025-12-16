import {
  IsString,
  IsUUID,
  IsOptional,
  ValidateNested,
  IsArray,
  IsInt,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class UpdateRequestedGuardFinanceDto {
  @ApiProperty()
  @IsOptional()
  @IsNumber()
  salaryPerMonth?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  gazettedHoliday?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  overtimePerHour?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  allowance?: number;
}

class UpdateRequestedGuardDto {
  @ApiProperty()
  @IsOptional()
  @IsUUID()
  guardCategoryId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiProperty()
  @IsOptional()
  @IsInt()
  quantity?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  gazettedHoliday?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  chargesPerMonth?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  overtimePerHour?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  allowance?: number;

  @ApiProperty({ type: () => UpdateRequestedGuardFinanceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateRequestedGuardFinanceDto)
  finances?: UpdateRequestedGuardFinanceDto;
}

class UpdateLocationTaxDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  taxType?: string;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  percentage?: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty()
  @IsOptional()
  @IsBoolean()
  addInvoice?: boolean;
}

export class UpdateLocationDto {
  @ApiProperty()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  officeId?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  locationName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  createdLocationId?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  provinceState?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  GPScoordinate?: string;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  locationTypeId?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  authorizedPersonName?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  authorizedPersonNumber?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  authorizedPersonDesignation?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiProperty({ type: () => [UpdateLocationTaxDto] })
  @IsOptional()
  @IsArray()
  @Type(() => UpdateLocationTaxDto)
  taxes?: UpdateLocationTaxDto[];

  @ApiProperty({ type: () => [UpdateRequestedGuardDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRequestedGuardDto)
  requestedGuards?: UpdateRequestedGuardDto[];

  @ApiProperty()
  @IsOptional()
  guardsRequirement?: any;

  @ApiProperty()
  @IsOptional()
  salaryCharges?: any;

  @ApiProperty()
  @IsOptional()
  setupInvoice?: any;
}
