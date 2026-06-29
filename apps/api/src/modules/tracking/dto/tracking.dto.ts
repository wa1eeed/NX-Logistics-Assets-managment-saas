import { IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TRACKING_PROVIDERS, type TrackingProvider } from '@nx-lam/shared';

export class RegisterDeviceBodyDto {
  @IsString()
  assetId!: string;

  @IsOptional() @IsIn(TRACKING_PROVIDERS)
  provider?: TrackingProvider;

  @IsString() @MinLength(2) @MaxLength(120)
  externalId!: string;
}

export class CreateGeofenceBodyDto {
  @IsString() @MinLength(2) @MaxLength(120)
  name!: string;

  @IsOptional() @IsIn(['CIRCLE', 'POLYGON'])
  type?: string;

  @IsObject()
  geo!: Record<string, unknown>;
}

export class IngestBodyDto {
  @IsString()
  externalId!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsOptional() @IsNumber()
  speed?: number;

  @IsOptional() @IsNumber()
  heading?: number;

  @IsOptional() @IsString()
  recordedAt?: string;
}
