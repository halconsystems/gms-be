import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEmail,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';

export class UpdateStoreDto {
  @ApiPropertyOptional({ description: 'Office ID' })
  @IsOptional()
  @IsUUID()
  officeId?: string;

  @ApiPropertyOptional({ description: 'Store name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Store location' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Store address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'Store phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Store email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Store manager name' })
  @IsOptional()
  @IsString()
  manager?: string;

  @ApiPropertyOptional({ description: 'Store storage capacity' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  capacity?: number;
}
