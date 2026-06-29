import { IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { PAYMENT_PURPOSES, PLATFORM_MODULES, type PaymentPurpose, type PlatformModule } from '@nx-lam/shared';

export class CheckoutDto {
  @IsEnum(PAYMENT_PURPOSES as unknown as object)
  purpose!: PaymentPurpose;

  /** WALLET_TOPUP: the top-up amount (major currency units, e.g. SAR). */
  @IsOptional()
  @IsNumber()
  @IsPositive()
  amount?: number;

  /** SEATS: number of seats to buy. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  /** MODULE: which module add-on to activate. */
  @IsOptional()
  @IsString()
  @IsEnum(PLATFORM_MODULES as unknown as object)
  module?: PlatformModule;

  /** TRACKING: number of vehicles to license. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  vehicleQuota?: number;
}
