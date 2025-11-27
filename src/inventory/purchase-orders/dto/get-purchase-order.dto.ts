import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { POStatus, PaymentStatus } from '@prisma/client';

export class GetPurchaseOrderDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by purchase request ID' })
  @IsOptional()
  @IsUUID()
  prId?: string;

  @ApiPropertyOptional({ description: 'Filter by vendor ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ description: 'Filter by store ID' })
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional({ description: 'Filter by status (DRAFT, SUBMITTED, CONFIRMED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED)' })
  @IsOptional()
  @IsIn(Object.values(POStatus))
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by payment status (PENDING, PARTIAL, PAID)' })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  paymentStatus?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO format)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO format)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}

