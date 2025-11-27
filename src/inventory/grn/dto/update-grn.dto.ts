import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { CreateGrnDto } from './create-grn.dto';

export class UpdateGrnDto extends PartialType(CreateGrnDto) {
  @ApiPropertyOptional({ description: 'Update notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
