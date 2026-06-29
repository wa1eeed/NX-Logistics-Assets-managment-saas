import { IsIn, IsInt, IsNumber, Min } from 'class-validator';
import { PLATFORM_MODULES, type PlatformModule } from '@nx-lam/shared';

export class TopUpDto {
  @IsNumber()
  @Min(1)
  amount!: number;
}

export class PurchaseSeatsDto {
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PurchaseModuleDto {
  @IsIn(PLATFORM_MODULES as unknown as string[])
  module!: PlatformModule;
}
