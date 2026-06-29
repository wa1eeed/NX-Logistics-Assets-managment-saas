import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { tenantContext } from './tenant-context';

/**
 * Establishes the per-request tenant context from the authenticated principal,
 * so the Prisma middleware scopes every query to the caller's tenant.
 * Runs after the auth guard (req.user is set); public routes resolve to null.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const tenantId = req?.user?.tenantId ?? null;
    return new Observable((subscriber) => {
      tenantContext.run({ tenantId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
