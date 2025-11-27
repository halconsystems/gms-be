import { IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsInt, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIssuanceItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'])
  condition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateIssuanceDto {
  @IsUUID()
  guardId: string;

  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIssuanceItemDto)
  items: CreateIssuanceItemDto[];
}
