import { SetMetadata } from '@nestjs/common';

export const REQUIRES_MODULE_KEY = 'requiresModule';

/**
 * Gates a controller/route behind a tenant feature flag from their subscription.
 * The ModuleAccessGuard rejects with 403 if the tenant's `enabledModules`
 * explicitly disables it. Example: @RequiresModule('finance')
 */
export const RequiresModule = (moduleName: string) =>
  SetMetadata(REQUIRES_MODULE_KEY, moduleName);
