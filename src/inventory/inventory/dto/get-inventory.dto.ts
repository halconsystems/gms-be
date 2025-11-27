import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsInt } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GetInventoryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by item ID' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ description: 'Filter by low stock items' })
  @IsOptional()
  isLowStock?: boolean;
}
