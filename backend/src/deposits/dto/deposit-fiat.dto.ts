import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

const PAYMENT_METHOD_TYPES = ['card', 'sepa', 'applepay'] as const;

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
    enum: PAYMENT_METHOD_TYPES,
    description:
      'How the deposit was funded when not using a saved method. When omitted, defaults to card. Ignored when paymentMethodId is set (type is taken from the saved payment method).',
  })
  @IsOptional()
  @IsIn([...PAYMENT_METHOD_TYPES])
  paymentMethodType?: (typeof PAYMENT_METHOD_TYPES)[number];
}
