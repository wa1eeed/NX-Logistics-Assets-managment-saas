import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/** Platform-admin payload to update a tenant's subscription / guardrails. */
export class UpdateSubscriptionDto {
  @IsOptional()
  @IsString()
  planId?: string | null;

  @IsOptional()
  @IsString()
  planName?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'TRIAL', 'PAST_DUE', 'SUSPENDED', 'CANCELED'])
  status?: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';

  @IsOptional()
  @IsInt()
  @Min(0)
  maxUserCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxStorageBytes?: number;

  /** Partial map of module → enabled, merged onto the existing flags. */
  @IsOptional()
  @IsObject()
  enabledModules?: Record<string, boolean>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  seatPriceMonthly?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perVehiclePrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  assetCap?: number | null;

  @IsOptional()
  @IsString()
  currentPeriodStart?: string | null;

  @IsOptional()
  @IsString()
  currentPeriodEnd?: string | null;

  @IsOptional()
  @IsString()
  renewsAt?: string | null;
}
