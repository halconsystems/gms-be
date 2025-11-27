import { IsOptional, IsInt, IsString, IsIn, IsDateString } from 'class-validator';

export class GetStockMovementsDto {
  @IsOptional()
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @IsInt()
  limit?: number = 10;

  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsIn(['INBOUND', 'OUTBOUND', 'ADJUSTMENT', 'TRANSFER', 'RETURN', 'ISSUANCE', 'CONSUMPTION'])
  movementType?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  movedBy?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

