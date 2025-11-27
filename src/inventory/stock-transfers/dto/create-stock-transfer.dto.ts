import { IsNotEmpty, IsUUID, IsOptional, IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStockTransferItemDto {
  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @IsNotEmpty()
  @Type(() => Number)
  quantityTransferred: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateStockTransferDto {
  @IsNotEmpty()
  @IsUUID()
  fromStoreId: string;

  @IsNotEmpty()
  @IsUUID()
  toStoreId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items: CreateStockTransferItemDto[];
}
