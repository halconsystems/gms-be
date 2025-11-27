import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetGrnDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by PO ID' })
  @IsOptional()
  @IsUUID()
  poId?: string;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by status (PENDING, INSPECTING, RECEIVED, PARTIAL, REJECTED)' })
  @IsOptional()
  @IsIn(['PENDING', 'INSPECTING', 'RECEIVED', 'PARTIAL', 'REJECTED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by GRN type (PURCHASE, TRANSFER, RETURN, ADJUSTMENT)' })
  @IsOptional()
  @IsIn(['PURCHASE', 'TRANSFER', 'RETURN', 'ADJUSTMENT'])
  grnType?: string;
}
