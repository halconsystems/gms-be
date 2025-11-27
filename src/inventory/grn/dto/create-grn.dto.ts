import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID, IsArray, ValidateNested, IsOptional, IsString, IsEnum, IsDateString, IsDecimal } from 'class-validator';
import { Type } from 'class-transformer';
import { GRNType } from 'src/prisma/prisma.types';

class GrnItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @ApiPropertyOptional({ description: 'Purchase Order Item ID (if from PO)' })
  @IsOptional()
  @IsUUID()
  poItemId?: string;

  @ApiProperty({ description: 'Quantity ordered' })
  @IsNotEmpty()
  @Type(() => Number)
  quantityOrdered: number;

  @ApiProperty({ description: 'Quantity received' })
  @IsNotEmpty()
  @Type(() => Number)
  quantityReceived: number;

  @ApiProperty({ description: 'Unit price' })
  @IsNotEmpty()
  @IsDecimal()
  unitPrice: string;

  @ApiPropertyOptional({ description: 'Condition status of received items' })
  @IsOptional()
  @IsString()
  conditionStatus?: string;

  @ApiPropertyOptional({ description: 'Batch number' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Serial number' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ description: 'Notes for this item' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGrnDto {
  @ApiProperty({ description: 'Store ID where goods are received' })
  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @ApiProperty({ description: 'Vendor ID' })
  @IsNotEmpty()
  @IsUUID()
  vendorId: string;

  @ApiPropertyOptional({ description: 'Purchase Order ID (optional link to PO)' })
  @IsOptional()
  @IsUUID()
  poId?: string;

  @ApiProperty({ description: 'GRN Type', enum: ['PURCHASE', 'TRANSFER', 'RETURN', 'ADJUSTMENT'] })
  @IsNotEmpty()
  @IsEnum(['PURCHASE', 'TRANSFER', 'RETURN', 'ADJUSTMENT'])
  grnType: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Items received', type: [GrnItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items: GrnItemDto[];
}

