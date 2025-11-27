import { IsOptional, IsInt, IsString } from 'class-validator';

export class GetReturnsDto {
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
  @IsString()
  issuanceId?: string;

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
