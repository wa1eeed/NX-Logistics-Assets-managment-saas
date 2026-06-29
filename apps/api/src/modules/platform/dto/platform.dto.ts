import { IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import type { TenantStatus } from '@nx-lam/shared';

export class CreateTenantBodyDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase letters, numbers and hyphens' })
  slug!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString() @MinLength(2)
  adminName!: string;

  @IsString() @MinLength(8)
  adminPassword!: string;
}

export class SetTenantStatusDto {
  @IsIn(['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELED'])
  status!: TenantStatus;
}

export class UpsertPlanBodyDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsInt() @Min(1)
  seats!: number;

  @IsInt() @Min(1)
  storageGb!: number;

  @IsOptional() @IsObject()
  features?: Record<string, boolean>;

  @IsNumber() @Min(0)
  priceMonthly!: number;

  @IsOptional() @IsNumber() @Min(0)
  perVehiclePrice?: number | null;

  @IsOptional() @IsInt() @Min(1)
  assetCap?: number | null;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsInt()
  sortOrder?: number;
}

export class ApplyPlanBodyDto {
  @IsString()
  planId!: string;
}
