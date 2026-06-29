import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_MODULE_KEY } from '../decorators/requires-module.decorator';
import { EntitlementsService } from '../../modules/entitlements/entitlements.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Enforces per-tenant feature flags on routes decorated with @RequiresModule().
 *
 * Runs as a global guard. Guards execute BEFORE interceptors, so the tenant
 * AsyncLocalStorage context isn't set yet — we read the tenant id straight from
 * `req.user.tenantId` and pass it explicitly to the entitlements lookup.
 */
@Injectable()
export class ModuleAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleName = this.reflector.getAllAndOverride<string>(REQUIRES_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!moduleName) return true; // route not gated

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    // No tenant (unauthenticated/public or a platform-level principal) → don't block here.
    if (!user?.tenantId) return true;

    await this.entitlements.assertModuleEnabled(moduleName, user.tenantId);
    return true;
  }
}
