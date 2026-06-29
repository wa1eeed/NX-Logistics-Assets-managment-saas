import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  adminPassword!: string;

  // بيانات الشركة الاختيارية عند التسجيل
  @IsOptional() @IsEmail()
  email?: string | null;

  @IsOptional() @IsString() @MaxLength(40)
  contactPhone?: string | null;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string | null;

  @IsOptional() @IsString() @Matches(/^\d{10}$/, { message: 'crNumber must be 10 digits' })
  crNumber?: string | null;

  @IsOptional() @IsString() @Matches(/^\d{15}$/, { message: 'vatNumber must be 15 digits' })
  vatNumber?: string | null;
}
