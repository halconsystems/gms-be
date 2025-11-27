import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetPurchaseRequestDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED)' })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: string;
}
