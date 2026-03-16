import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class DepositFiatDto {
  @ApiProperty({ enum: ['USD', 'EUR'] })
  @IsIn(['USD', 'EUR'])
  fiatCurrency: string;

  @ApiProperty({ example: 100.5, minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: 'Saved payment method ID' })
  @IsOptional()
  @IsUUID()
  paymentMethodId?: string;

  @ApiPropertyOptional({
    description: 'Inline payment (when no saved method)',
    example: { type: 'card', last4: '4242', brand: 'visa' },
  })
  @IsOptional()
  paymentMethod?: { type: string; last4?: string; brand?: string; iban_masked?: string };
}
