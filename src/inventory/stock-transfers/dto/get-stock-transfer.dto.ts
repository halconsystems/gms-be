import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetStockTransferDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by from store ID' })
  @IsOptional()
  @IsUUID()
  fromStoreId?: string;

  @ApiPropertyOptional({ description: 'Filter by to store ID' })
  @IsOptional()
  @IsUUID()
  toStoreId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsIn(['DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'])
  status?: string;
}
