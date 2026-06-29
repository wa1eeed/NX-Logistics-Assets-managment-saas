import { Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';

// StorageService is provided by the global StorageModule.
@Module({
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
