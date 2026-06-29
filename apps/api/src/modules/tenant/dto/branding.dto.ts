import { IsEmail, IsHexColor, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string | null;

  @IsOptional()
  @IsHexColor()
  primaryColor?: string | null;
}

/** Company account / tax-invoice profile fields. Validated only when provided. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'crNumber must be 10 digits' })
  crNumber?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{15}$/, { message: 'vatNumber must be 15 digits' })
  vatNumber?: string | null;
}
