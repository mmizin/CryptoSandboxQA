import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MinLength } from 'class-validator';

export class Disable2FaDto {
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code or 8-char backup code',
  })
  @IsString()
  @MinLength(6)
  code: string;
}
