import { IsArray, IsIn, IsOptional, ArrayMinSize } from 'class-validator';

export class DirectionsDto {
  @IsArray()
  @ArrayMinSize(2)
  coordinates!: [number, number][];

  @IsOptional()
  @IsIn(['driving-car', 'driving-hgv'])
  profile?: 'driving-car' | 'driving-hgv';
}

export class OptimizeDto {
  @IsArray()
  @ArrayMinSize(2)
  start!: [number, number];

  @IsOptional()
  @IsArray()
  end?: [number, number];

  @IsArray()
  @ArrayMinSize(1)
  stops!: [number, number][];

  @IsOptional()
  @IsIn(['driving-car', 'driving-hgv'])
  profile?: 'driving-car' | 'driving-hgv';
}
