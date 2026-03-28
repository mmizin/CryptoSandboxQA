import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { EMAIL_MAX_LENGTH } from '../../common/validation.constants';

export class ResetPasswordWithCodeDto {
  @ApiProperty({ example: 'you@example.com', maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({ description: '8-digit code from the reset email (spaces allowed)' })
  @Transform(({ value }) => String(value ?? '').replace(/\s/g, ''))
  @IsString()
  @Matches(/^\d{8}$/, { message: 'code must be 8 digits' })
  code!: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
