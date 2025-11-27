import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsUUID, IsNumber, IsInt } from 'class-validator';

export class CreateItemDto {
  @ApiProperty({ description: 'Item name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Stock Keeping Unit (unique per org)' })
  @IsNotEmpty()
  @IsString()
  sku: string;

  @ApiPropertyOptional({ description: 'Barcode' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Item description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Category ID' })
  @IsNotEmpty()
  @IsUUID()
  categoryId: string;

  @ApiProperty({ description: 'Group ID' })
  @IsNotEmpty()
  @IsUUID()
  groupId: string;

  @ApiProperty({ description: 'Unit of measurement (e.g., Pieces, Kg, Liter)' })
  @IsNotEmpty()
  @IsString()
  unitOfMeasurement: string;

  @ApiPropertyOptional({ description: 'Image URL or path' })
  @IsOptional()
  @IsString()
  imagePath?: string;

  @ApiPropertyOptional({ description: 'Reorder level quantity' })
  @IsOptional()
  @IsInt()
  reorderLevel?: number;

  @ApiPropertyOptional({ description: 'Reorder quantity' })
  @IsOptional()
  @IsInt()
  reorderQuantity?: number;

  @ApiPropertyOptional({ description: 'Minimum stock level' })
  @IsOptional()
  @IsInt()
  minStockLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum stock level' })
  @IsOptional()
  @IsInt()
  maxStockLevel?: number;

  @ApiPropertyOptional({ description: 'Initial purchase price' })
  @IsOptional()
  @IsNumber()
  initialPrice?: number;

  @ApiPropertyOptional({ description: 'Initial purchase date' })
  @IsOptional()
  initialPurchaseDate?: Date;

  @ApiPropertyOptional({ description: 'Expiry days' })
  @IsOptional()
  @IsInt()
  expiryDays?: number;

  @ApiPropertyOptional({ description: 'Service period (days)' })
  @IsOptional()
  @IsInt()
  servicePeriod?: number;

  @ApiPropertyOptional({ description: 'Preferred vendor ID' })
  @IsOptional()
  @IsUUID()
  preferredVendorId?: string;
}

