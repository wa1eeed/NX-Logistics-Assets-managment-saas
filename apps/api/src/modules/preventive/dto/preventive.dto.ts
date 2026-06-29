import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { METER_TYPES, PLAN_INTERVAL_TYPES, type MeterType, type PlanIntervalType } from '@nx-lam/shared';

export class RecordMeterDto {
  @IsInt() @Min(0) @Max(100_000_000)
  value!: number;

  @IsOptional() @IsString()
  note?: string;
}

export class SetMeterTypeDto {
  @IsIn(METER_TYPES as unknown as string[])
  meterType!: MeterType;
}

export class CreatePlanDto {
  @IsString() @MinLength(2)
  name!: string;

  @IsIn(PLAN_INTERVAL_TYPES as unknown as string[])
  intervalType!: PlanIntervalType;

  @IsInt() @Min(1)
  intervalValue!: number;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MinLength(2)
  name?: string;

  @IsOptional() @IsIn(PLAN_INTERVAL_TYPES as unknown as string[])
  intervalType?: PlanIntervalType;

  @IsOptional() @IsInt() @Min(1)
  intervalValue?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
