import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TriggerScanResponseDto {
  @ApiProperty({ description: 'Unique scan identifier' })
  scanId: string;

  @ApiProperty({ description: 'S3 URL of the captured fingerprint image' })
  s3Url: string;

  @ApiProperty({ description: 'S3 object key of the captured fingerprint image' })
  s3Key: string;

  @ApiPropertyOptional({ description: 'Capture quality score reported by the agent' })
  quality?: number;

  @ApiPropertyOptional({ description: 'Finger name reported by the agent or supplied as hint' })
  fingerName?: string;
}
