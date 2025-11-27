import { IsNotEmpty, IsUUID, IsString, IsOptional, IsArray, ValidateNested, IsDecimal, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @IsNotEmpty()
  @IsUUID()
  itemId: string;

  @IsNotEmpty()
  @Type(() => Number)
  quantityOrdered: number;

  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '1,2' })
  unitPrice: string;

  @IsNotEmpty()
  @IsDecimal({ decimal_digits: '1,2' })
  totalPrice: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsNotEmpty()
  @IsUUID()
  vendorId: string;

  @IsNotEmpty()
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsUUID()
  prId?: string;

  @IsOptional()
  @IsDateString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  taxAmount?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  shippingCost?: string;

  @IsOptional()
  @IsDecimal({ decimal_digits: '1,2' })
  discountAmount?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
