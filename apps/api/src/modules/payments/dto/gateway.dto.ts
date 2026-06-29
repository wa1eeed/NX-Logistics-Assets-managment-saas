import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@nx-lam/shared';

export class UpdateGatewayDto {
  @IsOptional()
  @IsIn(PAYMENT_PROVIDERS)
  provider?: PaymentProvider;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  publicKey?: string | null;

  /** Omit/empty to keep the stored secret key. */
  @IsOptional()
  @IsString()
  secretKey?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}
