import {
  IsArray, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MaintenanceType, WorkOrderSource, WorkOrderStatus } from '@nx-lam/shared';

export class CreateWorkOrderDto {
  @IsString()
  assetId!: string;

  @IsIn(Object.values(WorkOrderSource))
  source!: WorkOrderSource;

  @IsOptional() @IsIn(Object.values(MaintenanceType))
  type?: MaintenanceType;

  @IsOptional() @IsString()
  priority?: string;

  @IsOptional() @IsString()
  description?: string;
}

export class MaintenancePartDto {
  @IsString()
  name!: string;

  @IsOptional() @IsNumber() @Min(0)
  quantity?: number;

  @IsOptional() @IsNumber() @Min(0)
  cost?: number;
}

export class UpdateCardDto {
  @IsOptional() @IsString()
  worksDone?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MaintenancePartDto)
  parts?: MaintenancePartDto[];

  @IsOptional() @IsString()
  technician?: string;

  @IsOptional() @IsNumber() @Min(0)
  laborHours?: number;
}

export class CloseWorkOrderDto {
  @IsOptional() @IsNumber() @Min(0)
  totalCost?: number;
}

export class WorkOrderQueryDto {
  @IsOptional() @IsIn(Object.values(WorkOrderStatus))
  status?: WorkOrderStatus;

  @IsOptional() @IsIn(Object.values(MaintenanceType))
  type?: MaintenanceType;

  @IsOptional() @IsString()
  assetId?: string;
}

export class UploadWorkOrderDocDto {
  @IsString()
  docType!: string;
}
