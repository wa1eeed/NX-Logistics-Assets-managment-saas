import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSellerDto {
  @IsOptional() @IsString() @MaxLength(160)
  name?: string;

  @IsOptional() @IsString() @MaxLength(20)
  vatNumber?: string | null;

  @IsOptional() @IsString() @MaxLength(20)
  crNumber?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  address?: string | null;
}
