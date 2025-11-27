import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApprovePurchaseRequestDto {
  @ApiPropertyOptional({ description: 'Approval notes/reason' })
  @IsOptional()
  @IsString()
  notes?: string;
}
