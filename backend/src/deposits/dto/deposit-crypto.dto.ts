import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class DepositCryptoDto {
  @ApiProperty({ example: 'BTC' })
  @IsString()
  symbol: string;

  @ApiProperty({ example: 0.001, minimum: 0.00001 })
  @IsNumber()
  @Min(0.00001)
  amount: number;

  @ApiProperty({ example: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' })
  @IsString()
  walletAddress: string;

  @ApiPropertyOptional({ description: 'Blockchain tx hash for confirmation' })
  @IsOptional()
  @IsString()
  txHash?: string;
}
