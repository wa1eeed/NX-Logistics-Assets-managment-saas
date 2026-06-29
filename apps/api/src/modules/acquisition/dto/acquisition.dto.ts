import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SupplierDealType } from '@nx-lam/shared';

const BEARERS = ['COMPANY', 'SUPPLIER'];

export class CreateSupplierDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsOptional() @IsIn(Object.values(SupplierDealType))
  dealType?: SupplierDealType;

  @IsOptional() @IsObject()
  contact?: Record<string, unknown>;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString() @MinLength(2)
  name?: string;

  @IsOptional() @IsIn(Object.values(SupplierDealType))
  dealType?: SupplierDealType;

  @IsOptional() @IsObject()
  contact?: Record<string, unknown>;
}

export class CreateLeaseDto {
  @IsString()
  assetId!: string;

  @IsString()
  supplierId!: string;

  @IsNumber() @Min(0)
  periodicRate!: number;

  @IsOptional() @IsString()
  ratePeriod?: string; // MONTHLY | WEEKLY | DAILY

  @IsString()
  startDate!: string;

  @IsString()
  endDate!: string;

  @IsOptional() @IsIn(BEARERS)
  maintenanceBearer?: string;

  @IsOptional() @IsIn(BEARERS)
  insuranceBearer?: string;

  @IsOptional() @IsBoolean()
  returnObligation?: boolean;
}
