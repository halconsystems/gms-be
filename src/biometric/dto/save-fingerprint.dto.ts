import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class SaveFingerprintDto {
  @ApiProperty({
    description: 'Base64 encoded fingerprint image from capture',
    type: String,
    example: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^data:image\/\w+;base64,.+|^[A-Za-z0-9+/=]+$/, {
    message: 'image must be a valid base64 string or data URI',
  })
  image: string;

  @ApiPropertyOptional({
    description: 'Base64 encoded fingerprint template for database storage',
    type: String,
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiProperty({
    description: "Name/identifier for the finger (e.g., 'left_thumb', 'right_index')",
    type: String,
    example: 'left_thumb',
  })
  @IsNotEmpty()
  @IsString()
  fingerName: string;

  @ApiPropertyOptional({
    description: 'ID of the guard/employee (for organizing S3 keys)',
    type: String,
  })
  @IsOptional()
  @IsString()
  personId?: string;
}

export class SaveFingerprintResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({
    description: 'The S3 key where the image was stored',
    type: String,
  })
  s3Key: string;

  @ApiPropertyOptional({
    description: 'Presigned URL for immediate access',
    type: String,
  })
  url?: string;

  @ApiPropertyOptional({
    description: 'Echo back the template if provided',
    type: String,
  })
  template?: string;
}
