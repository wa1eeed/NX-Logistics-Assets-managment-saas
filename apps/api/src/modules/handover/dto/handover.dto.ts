import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CONDITION_RATINGS, InspectionKind } from '@nx-lam/shared';

export class ChecklistEntryDto {
  @IsString()
  key!: string;

  @IsIn(CONDITION_RATINGS)
  condition!: string;

  @IsOptional() @IsString()
  note?: string;
}

export class CreateInspectionDto {
  @IsIn(Object.values(InspectionKind))
  kind!: InspectionKind;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ChecklistEntryDto)
  checklist!: ChecklistEntryDto[];

  @IsOptional() @IsInt() @Min(0)
  odometer?: number;

  @IsOptional() @IsString()
  notes?: string;

  /** Internal confirmation (decision #4): name + role of the signer. */
  @IsString()
  signedBy!: string;

  @IsOptional() @IsString()
  signedByRole?: string;
}
