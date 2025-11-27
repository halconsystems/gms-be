import { IsOptional, IsInt, IsString, IsIn } from 'class-validator';

export class GetInventoryCardsDto {
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
  guardId?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'RETURNED', 'LOST', 'DAMAGED'])
  status?: string;

  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
