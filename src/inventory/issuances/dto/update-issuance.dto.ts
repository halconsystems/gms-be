import { IsString, IsOptional, IsInt, IsIn } from 'class-validator';

export class UpdateIssuanceDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['ISSUED', 'PARTIAL_RETURN', 'FULL_RETURN', 'DAMAGED'])
  status?: string;
}

export class UpdateIssuanceItemDto {
  @IsOptional()
  @IsInt()
  quantity?: number;

  @IsOptional()
  @IsString()
  unitOfMeasurement?: string;

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
