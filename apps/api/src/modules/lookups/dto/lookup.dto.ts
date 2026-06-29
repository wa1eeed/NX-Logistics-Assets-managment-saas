import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { LOOKUP_TYPE_KEYS } from '@nx-lam/shared';

export class CreateLookupDto {
  @IsIn(LOOKUP_TYPE_KEYS)
  type!: string;

  @IsString() @MinLength(1)
  labelEn!: string;

  @IsOptional() @IsString()
  labelAr?: string;

  /** Stored value; defaults to labelEn if omitted. */
  @IsOptional() @IsString()
  value?: string;

  @IsOptional() @IsInt()
  sortOrder?: number;
}

export class UpdateLookupDto {
  @IsOptional() @IsString() @MinLength(1)
  labelEn?: string;

  @IsOptional() @IsString()
  labelAr?: string | null;

  @IsOptional() @IsInt()
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
