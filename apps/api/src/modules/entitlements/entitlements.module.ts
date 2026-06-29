import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';

/**
 * Global so the storage layer, users service and the ModuleAccessGuard can all
 * inject EntitlementsService without re-importing the module everywhere.
 */
@Global()
@Module({
  controllers: [EntitlementsController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
