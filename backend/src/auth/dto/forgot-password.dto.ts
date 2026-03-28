import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, MaxLength } from 'class-validator';
import { EMAIL_MAX_LENGTH } from '../../common/validation.constants';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'you@example.com', maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;
}
