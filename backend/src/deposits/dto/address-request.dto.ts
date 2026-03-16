import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AddressRequestDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  @MinLength(1)
  symbol: string;
}
