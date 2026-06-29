import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { StorageReconcileScheduler } from './storage-reconcile.scheduler';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, StorageReconcileScheduler],
  exports: [StorageService],
})
export class StorageModule {}
