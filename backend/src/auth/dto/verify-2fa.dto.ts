import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class Verify2FaDto {
  @ApiProperty({
    description: 'Temporary token from login response when 2FA required',
  })
  @IsString()
  @MinLength(1)
  tempToken: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code or 8-char backup code',
  })
  @IsString()
  @MinLength(6)
  code: string;
}
