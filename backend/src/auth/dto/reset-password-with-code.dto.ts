import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class ResetPasswordWithCodeDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsEmail()
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
