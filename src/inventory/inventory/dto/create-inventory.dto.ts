import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class CreateInventoryDto {
  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  minStockLevel?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStockLevel?: number;
}
