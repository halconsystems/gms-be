import { IsString, IsOptional, IsIn, IsInt, IsBoolean } from 'class-validator';

export class UpdateInventoryCardDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'RETURNED', 'LOST', 'DAMAGED'])
  status?: string;
}

export class UpdateInventoryCardItemDto {
  @IsOptional()
  @IsInt()
  quantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

  @IsOptional()
  @IsBoolean()
  isNewSupply?: boolean;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsIn(['NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'])
  condition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
