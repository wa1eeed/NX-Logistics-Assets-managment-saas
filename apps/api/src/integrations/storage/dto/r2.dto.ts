import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { STORAGE_MODES, STORAGE_PROVIDERS, type StorageMode, type StorageProvider } from '@nx-lam/shared';

/** Platform shared storage account (the master account, all companies' folders). */
export class UpdatePlatformStorageDto {
  @IsOptional() @IsIn(STORAGE_PROVIDERS as unknown as string[])
  provider?: StorageProvider;

  @IsOptional() @IsString()
  endpoint?: string | null;

  @IsOptional() @IsString()
  accessKeyId?: string | null;

  // Only send when changing it; empty/omitted keeps the stored secret.
  @IsOptional() @IsString()
  secretAccessKey?: string;

  @IsOptional() @IsString()
  bucket?: string | null;

  @IsOptional() @IsString()
  region?: string | null;

  @IsOptional() @IsString()
  publicBaseUrl?: string | null;

  @IsOptional() @IsInt() @Min(30)
  ttl?: number | null;
}

/** A single company's storage option (shared folder, or its own dedicated bucket). */
export class UpdateTenantStorageDto {
  @IsOptional() @IsIn(STORAGE_MODES as unknown as string[])
  mode?: StorageMode;

  @IsOptional() @IsIn(STORAGE_PROVIDERS as unknown as string[])
  provider?: StorageProvider;

  @IsOptional() @IsString()
  endpoint?: string | null;

  @IsOptional() @IsString()
  accessKeyId?: string | null;

  @IsOptional() @IsString()
  secretAccessKey?: string;

  @IsOptional() @IsString()
  bucket?: string | null;

  @IsOptional() @IsString()
  region?: string | null;

  @IsOptional() @IsString()
  publicBaseUrl?: string | null;

  @IsOptional() @IsInt() @Min(30)
  ttl?: number | null;
}
