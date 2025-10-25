import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsInt,
  Min,
  ValidateIf,
  ValidateNested,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssignSupervisorDto {
  @ApiPropertyOptional({
    description: 'Service Number of the person to assign a supervisor to',
  })
  @ValidateIf((o) => !o.employeeId)
  @IsInt()
  @Min(1)
  @Type(() => Number)
  serviceNumber?: number;

  @ApiPropertyOptional({
    description:
      'Employee ID of the person to assign a supervisor to (for backward compatibility)',
  })
  @ValidateIf((o) => !o.serviceNumber)
  @IsUUID()
  employeeId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({
    description: 'Service Number of the supervisor (Guard or Employee)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ValidateIf((o) => !o.supervisorEmployeeId)
  supervisorServiceNumber?: number;

  @ApiPropertyOptional({
    description: 'Employee ID of the supervisor (for backward compatibility)',
  })
  @IsUUID()
  @ValidateIf((o) => !o.supervisorServiceNumber)
  supervisorEmployeeId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deploymentTill?: string;
}
