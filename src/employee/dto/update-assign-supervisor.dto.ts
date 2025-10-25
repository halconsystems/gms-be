import { PartialType } from '@nestjs/mapped-types';
import { AssignSupervisorDto } from './assign-supervisor.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateAssignSupervisorDto {
  @ApiProperty()
  @IsOptional()
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({
    description: 'Service Number of the supervisor (Guard or Employee)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supervisorServiceNumber?: number;

  @ApiProperty()
  @IsOptional()
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deploymentTill: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Employee ID of the supervisor (for backward compatibility)',
  })
  @IsOptional()
  @IsUUID()
  supervisorEmployeeId?: string;
}
