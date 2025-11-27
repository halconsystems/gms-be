import { IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsInt, IsBoolean, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryCardItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

  @IsOptional()
  @IsBoolean()
  isNewSupply?: boolean;

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

export class CreateInventoryCardDto {
  @IsString()
  cardNumber: string;

  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsUUID()
  guardId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryCardItemDto)
  items: CreateInventoryCardItemDto[];
}
