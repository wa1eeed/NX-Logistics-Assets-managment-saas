import { IsArray, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import type { CustomFieldDef } from '@nx-lam/shared';

export class CreateAssetTypeDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  assetClassId?: string;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;
}

export class UpdateAssetTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  assetClassId?: string | null;

  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown> | null;

  @IsOptional()
  @IsArray()
  customFields?: CustomFieldDef[] | null;
}
