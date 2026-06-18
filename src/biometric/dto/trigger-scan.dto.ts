import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TriggerScanDto {
  @ApiPropertyOptional({
    description: 'Optional finger name hint (non-authoritative, for UI labeling only)',
    example: 'rightThumb',
  })
  @IsOptional()
  @IsString()
  fingerName?: string;
}
