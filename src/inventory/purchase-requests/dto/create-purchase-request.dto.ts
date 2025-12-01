import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsArray, ValidateNested, IsOptional, IsString, IsISO8601 } from 'class-validator';
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

  @ApiProperty({ description: 'Unit of Measurement' })
  @IsNotEmpty()
  @IsString()
  unitOfMeasurement: string;

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
  @ApiPropertyOptional({ description: 'Store ID (auto-filled from user context if not provided)' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Required date for the purchase (ISO 8601 format: YYYY-MM-DD or full ISO string, auto-filled with current date if not provided)' })
  @IsOptional()
  @IsISO8601({ strict: false })
  requiredDate?: string;

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
