import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsArray, ValidateNested, IsUUID, IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class ReceiveItemDto {
  @ApiProperty({ description: 'GRN Item ID' })
  @IsNotEmpty()
  @IsUUID()
  grnItemId: string;

  @ApiProperty({ description: 'Quantity accepted' })
  @IsNotEmpty()
  @Type(() => Number)
  quantityAccepted: number;

  @ApiPropertyOptional({ description: 'Quantity rejected' })
  @IsOptional()
  @Type(() => Number)
  quantityRejected?: number;

  @ApiPropertyOptional({ description: 'Condition status' })
  @IsOptional()
  @IsString()
  conditionStatus?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveGrnDto {
  @ApiProperty({ description: 'Items to receive', type: [ReceiveItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional({ description: 'Receiver notes' })
  @IsOptional()
  @IsString()
  receiverNotes?: string;
}
