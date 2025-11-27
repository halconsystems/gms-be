import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsArray, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class PurchaseRequestItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @ApiProperty({ description: 'Quantity requested' })
  @IsNotEmpty()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ description: 'Unit price (optional)' })
  @IsOptional()
  @Type(() => Number)
  unitPrice?: number;

  @ApiPropertyOptional({ description: 'Notes for this item' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseRequestDto {
  @ApiProperty({ description: 'Store ID' })
  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @ApiPropertyOptional({ description: 'Required date for the purchase' })
  @IsOptional()
  requiredDate?: Date;

  @ApiPropertyOptional({ description: 'Notes for the request' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Items in the request', type: [PurchaseRequestItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseRequestItemDto)
  items: PurchaseRequestItemDto[];
}
