import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { MapProviderId } from '@nx-lam/shared';

export class UpdateMapsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['auto', 'google', 'osm'])
  provider?: MapProviderId;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  routingApiKey?: string;
}
