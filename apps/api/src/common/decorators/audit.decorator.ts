import { SetMetadata } from '@nestjs/common';

export const AUDIT_ENTITY_KEY = 'auditEntity';

/**
 * Labels a controller/route with the entity type recorded in the audit log
 * for write operations. Example: @AuditEntity('User')
 */
export const AuditEntity = (entityType: string) =>
  SetMetadata(AUDIT_ENTITY_KEY, entityType);
