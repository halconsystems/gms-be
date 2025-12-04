import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * DTO for converting a Purchase Request to a Purchase Order
 * This endpoint takes a PR ID and creates a PO with items from the PR
 */
export class ConvertPrToPoDto {
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
