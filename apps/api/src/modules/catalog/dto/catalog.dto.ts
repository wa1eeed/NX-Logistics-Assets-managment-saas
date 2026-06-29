import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

const FIELD_PROFILES = ['VEHICLE', 'EQUIPMENT', 'GENERIC'];

export class CreateAssetClassDto {
  @IsString() @MinLength(2)
  code!: string;

  @IsString() @MinLength(2)
  labelEn!: string;

  @IsOptional() @IsString()
  labelAr?: string;

  @IsOptional() @IsIn(FIELD_PROFILES)
  fieldProfile?: string;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateAssetClassDto {
  @IsOptional() @IsString() @MinLength(2)
  labelEn?: string;

  @IsOptional() @IsString()
  labelAr?: string | null;

  @IsOptional() @IsIn(FIELD_PROFILES)
  fieldProfile?: string;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateModelDto {
  @IsString() @MinLength(1)
  manufacturer!: string;

  @IsString() @MinLength(1)
  name!: string;

  @IsOptional() @IsString()
  category?: string;

  @IsString()
  assetTypeId!: string;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateModelDto {
  @IsOptional() @IsString() @MinLength(1)
  manufacturer?: string;

  @IsOptional() @IsString() @MinLength(1)
  name?: string;

  @IsOptional() @IsString()
  category?: string | null;

  @IsOptional() @IsString()
  assetTypeId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ModelQueryDto {
  @IsOptional() @IsString()
  manufacturer?: string;

  @IsOptional() @IsString()
  assetTypeId?: string;

  @IsOptional() @IsString()
  assetClass?: string; // class code
}
