import { IsIn, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ContractStatus, EquipmentRequestStatus } from '@nx-lam/shared';

export class CreateRequestDto {
  @IsString()
  orgUnitId!: string;

  @IsString()
  assetTypeId!: string;

  @IsString()
  fromDate!: string;

  @IsString()
  toDate!: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ApproveRequestDto {
  @IsString()
  assetId!: string;
}

export class IssueContractDto {
  @IsOptional() @IsString() @MinLength(2)
  authorizationNo?: string;

  @IsOptional() @IsNumber() @Min(0)
  internalRate?: number;
}

/** One-step transport action: pick the asset + dispatch it to the project. */
export class AssignDispatchDto {
  @IsString()
  assetId!: string;

  @IsOptional() @IsString() @MinLength(2)
  authorizationNo?: string;

  @IsOptional() @IsNumber() @Min(0)
  internalRate?: number;
}

export class ExtendContractDto {
  @IsString()
  endDate!: string;
}

export class RequestQueryDto {
  @IsOptional() @IsIn(Object.values(EquipmentRequestStatus))
  status?: EquipmentRequestStatus;

  @IsOptional() @IsString()
  orgUnitId?: string;
}

export class ContractQueryDto {
  @IsOptional() @IsIn(Object.values(ContractStatus))
  status?: ContractStatus;

  @IsOptional() @IsString()
  orgUnitId?: string;
}
