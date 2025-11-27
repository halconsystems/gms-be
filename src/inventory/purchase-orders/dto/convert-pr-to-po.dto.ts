import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for converting a Purchase Request to a Purchase Order
 * This endpoint takes a PR ID and vendor/store selection, then creates and persists the PO
 */
export class ConvertPrToPoDto {
  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  expectedDeliveryDate?: string;

  @IsOptional()
  @IsString()
  taxAmount?: string;

  @IsOptional()
  @IsString()
  shippingCost?: string;

  @IsOptional()
  @IsString()
  discountAmount?: string;
}
