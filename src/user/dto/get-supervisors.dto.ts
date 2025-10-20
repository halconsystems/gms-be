import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetSupervisorsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clientId?: string;
}