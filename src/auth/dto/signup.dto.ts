import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class SignupDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  password: string;

  @ApiProperty()
  @IsString()
  userName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileImage?: string;

  @ApiProperty({ description: 'Role name to assign' })
  @IsString()
  roleName: string;

  @ApiProperty()
  @IsString()
  officeId: string;

  @ApiProperty()
  @IsString()
  organizationId: string;
}