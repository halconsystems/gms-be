import { IsString, IsOptional, IsInt } from 'class-validator';

export class UpdateReturnDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateReturnItemDto {
  @IsOptional()
  @IsInt()
  quantityReturned?: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
