import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_ENTITY_KEY } from '../decorators/audit.decorator';
import { AuthenticatedUser } from '../types/authenticated-user';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Generic append-only audit of every successful write request.
 * Services may additionally call AuditService.record() for richer
 * before/after state on important transitions.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (!WRITE_METHODS.has(method)) {
      return next.handle();
    }

    const entityType = this.reflector.getAllAndOverride<string>(AUDIT_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Only audit annotated domain controllers; skip auth/health/dashboard noise.
    if (!entityType) {
      return next.handle();
    }

    const user = req.user as AuthenticatedUser | undefined;
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? null;

    return next.handle().pipe(
      tap((response) => {
        const entityId =
          (response && typeof response === 'object' && 'id' in response
            ? String((response as { id: unknown }).id)
            : undefined) ??
          req.params?.id ??
          'n/a';

        void this.audit.record({
          actorId: user?.id ?? null,
          action: `${method} ${req.route?.path ?? req.url}`,
          entityType,
          entityId,
          after: response,
          ip,
        });
      }),
    );
  }
}
