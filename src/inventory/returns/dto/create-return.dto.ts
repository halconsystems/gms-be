import { IsString, IsUUID, IsOptional, IsArray, ValidateNested, IsInt, IsIn, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReturnItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  quantityReturned: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

  @IsOptional()
  @IsIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'])
  condition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateReturnDto {
  @IsUUID()
  issuanceId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}
