import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  IsDefined,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PersonType } from '../../common/enums/person-type.enum';

export class CreateServiceNumberUserDto {
  @ApiPropertyOptional({
    example: 1001,
    description: 'Service number of the employee or guard (required when personType is EMPLOYEE or GUARD)',
  })
  @ValidateIf((o) => o.personType !== PersonType.CLIENT)
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceNumber?: number;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the client (required when personType is CLIENT)',
  })
  @ValidateIf((o) => o.personType === PersonType.CLIENT)
  @IsDefined()
  @IsUUID()
  clientId?: string;

  @ApiProperty({
    enum: PersonType,
    example: PersonType.EMPLOYEE,
    description: 'Type of person (EMPLOYEE, GUARD, or CLIENT)',
  })
  @IsDefined()
  @IsEnum(PersonType)
  personType: PersonType;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the office',
  })
  @IsUUID()
  officeId: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address for the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password for the user account',
  })
  @IsString()
  password: string;

  @ApiProperty({ example: 'johndoe', description: 'Username for the account' })
  @IsString()
  userName: string;

  @ApiProperty({
    example: 'profile.jpg',
    description: 'Profile image filename',
    required: false,
  })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID of the role',
  })
  @IsUUID()
  roleId: string;
}
