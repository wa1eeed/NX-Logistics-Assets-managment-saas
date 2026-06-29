import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { SaleOrderStatus } from '@nx-lam/shared';

export class ProposeSaleDto {
  @IsString()
  assetId!: string;

  @IsOptional() @IsNumber() @Min(0)
  askingPrice?: number;
}

export class CompleteSaleDto {
  @IsNumber() @Min(0)
  salePrice!: number;

  @IsString() @MinLength(2)
  buyerName!: string;
}

export class SaleQueryDto {
  @IsOptional() @IsIn(Object.values(SaleOrderStatus))
  status?: SaleOrderStatus;
}
