import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, MinLength, Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssetStatus, OwnershipType } from '@nx-lam/shared';

const OWNERSHIP = Object.values(OwnershipType);
const STATUSES = Object.values(AssetStatus);

export class CreateAssetDto {
  @IsString() @MinLength(2)
  code!: string;

  // Catalog-driven: a model implies the type/category/brand. assetTypeId is a fallback.
  @IsOptional() @IsString()
  modelId?: string;

  @IsOptional() @IsString()
  assetTypeId?: string;

  @IsIn(OWNERSHIP)
  ownershipType!: OwnershipType;

  @IsOptional() @IsString()
  serialNo?: string;

  @IsOptional() @IsString()
  capacity?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsObject()
  customValues?: Record<string, unknown>;

  @IsOptional() @IsString()
  plateNumber?: string;

  @IsOptional() @IsString()
  vin?: string;

  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsInt() @Min(1950) @Max(2100)
  year?: number;

  @IsOptional() @IsString()
  region?: string;

  @IsOptional() @IsString()
  siteName?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  purchaseDate?: string;

  // financial (applied only if caller has finance.read)
  @IsOptional() @IsNumber() @Min(0)
  purchasePrice?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  depreciationRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  bookValue?: number;
}

export class UpdateAssetDto {
  @IsOptional() @IsString()
  model?: string;

  @IsOptional() @IsString()
  manufacturer?: string | null;

  @IsOptional() @IsString()
  color?: string | null;

  @IsOptional() @IsString()
  serialNo?: string | null;

  @IsOptional() @IsString()
  capacity?: string | null;

  @IsOptional() @IsObject()
  customValues?: Record<string, unknown>;

  @IsOptional() @IsInt() @Min(1950) @Max(2100)
  year?: number;

  @IsOptional() @IsString()
  region?: string | null;

  @IsOptional() @IsString()
  siteName?: string | null;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  purchaseDate?: string | null;

  @IsOptional() @IsString()
  currentOrgUnitId?: string | null;

  // financial — stripped unless caller has finance.read
  @IsOptional() @IsNumber() @Min(0)
  purchasePrice?: number | null;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  depreciationRate?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  bookValue?: number | null;
}

export class UpdateVehicleDto {
  @IsOptional() @IsString()
  plateNumber?: string | null;

  @IsOptional() @IsString()
  vin?: string | null;

  @IsOptional() @IsString()
  registrationExpiry?: string | null;

  @IsOptional() @IsString()
  periodicInspection?: string | null;

  @IsOptional() @IsString()
  insuranceExpiry?: string | null;

  @IsOptional() @IsString()
  operatingCardNo?: string | null;

  @IsOptional() @IsString()
  customsCardNo?: string | null;

  @IsOptional() @IsString()
  currentDriverId?: string | null;
}

export class ReadinessEntryDto {
  @IsString()
  key!: string;

  @IsBoolean()
  ok!: boolean;

  @IsOptional() @IsString()
  note?: string;
}

export class CommissionDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => ReadinessEntryDto)
  checklist!: ReadinessEntryDto[];

  @IsOptional() @IsString()
  notes?: string;
}

export class ChangeStatusDto {
  @IsIn(STATUSES)
  status!: AssetStatus;

  @IsOptional() @IsBoolean()
  forSaleFlag?: boolean;

  @IsOptional() @IsString()
  reason?: string;
}

export class AssetQueryDto {
  @IsOptional() @IsIn(STATUSES)
  status?: AssetStatus;

  @IsOptional() @IsIn(OWNERSHIP)
  ownershipType?: OwnershipType;

  @IsOptional() @IsString()
  assetTypeId?: string;

  @IsOptional() @IsString()
  assetClass?: string;

  @IsOptional() @IsString()
  search?: string;
}
