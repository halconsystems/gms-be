import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for fingerprint capture request to local agent
 * 
 * All numeric fields use @Type(() => Number) for explicit transformation
 * because JSON payloads from frontend may send numbers as strings.
 * 
 * Transformation flow:
 * 1. Frontend sends: {deviceIndex: 0, maxRetries: 3, timeout: 15000} (may be strings in JSON)
 * 2. Global ValidationPipe (main.ts) with transform: true applies @Type decorators
 * 3. class-transformer converts strings to numbers before validation
 * 4. @IsNumber(), @Min(), @Max() validate the transformed numbers
 * 5. Controller receives fully-typed DTO with numeric fields
 * 6. Service normalizes again as safety net (biometric.service.ts lines 56-60)
 * 
 * If transformation fails, check:
 * - Global ValidationPipe has transform: true and enableImplicitConversion: true
 * - class-transformer and class-validator versions are compatible (^0.5.1 and ^0.14.2)
 * - No custom body parser interfering with NestJS's internal parsing
 */
export class CaptureFingerprintDto {
  @ApiPropertyOptional({
    description: 'Index of the fingerprint device to use',
    default: 0,
    type: Number,
  })
  // @Type(() => Number) explicitly transforms string values to numbers during validation
  // Required because JSON payloads may send "0" (string) instead of 0 (number)
  // Works with global ValidationPipe's enableImplicitConversion: true in main.ts
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  deviceIndex?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum retry attempts for capture',
    default: 3,
    type: Number,
  })
  // Explicit number transformation for retry count (handles string "3" → number 3)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxRetries?: number = 3;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds',
    default: 15000,
    type: Number,
  })
  // Explicit number transformation for timeout milliseconds (handles string "15000" → number 15000)
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(60000)
  timeout?: number = 15000;
}

/**
 * Fingerprint data returned by the local agent
 */
export class CaptureDataDto {
  @ApiProperty({
    description: 'Base64 encoded fingerprint image',
    type: String,
  })
  image: string;

  @ApiProperty({
    description: 'Base64 encoded fingerprint template',
    type: String,
  })
  template: string;

  @ApiProperty({
    description: 'Image width in pixels',
    type: Number,
  })
  width: number;

  @ApiProperty({
    description: 'Image height in pixels',
    type: Number,
  })
  height: number;

  @ApiPropertyOptional({
    description: 'Quality score from SDK (null if using 5-arg variant)',
    type: Number,
    nullable: true,
  })
  qualityScore?: number | null;

  @ApiProperty({
    description: 'ISO timestamp of capture',
    type: String,
  })
  timestamp: string;

  @ApiProperty({
    description: 'Image format (image/png or raw)',
    type: String,
    enum: ['image/png', 'raw'],
  })
  format: string;

  @ApiPropertyOptional({
    description: 'Data URI for preview (null for raw format)',
    type: String,
    nullable: true,
  })
  dataUri?: string | null;
}

export class CaptureResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({
    description: 'Captured fingerprint data from agent',
    type: CaptureDataDto,
  })
  data: CaptureDataDto;

  @ApiProperty()
  requestId: string;
}
