import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { OrgUnitKind } from '@nx-lam/shared';

const KINDS = Object.values(OrgUnitKind);

export class CreateOrgUnitDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsIn(KINDS)
  kind!: OrgUnitKind;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  managerId?: string | null;
}

export class UpdateOrgUnitDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(KINDS)
  kind?: OrgUnitKind;

  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  managerId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
