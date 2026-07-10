import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMapsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  routingApiKey?: string;
}
