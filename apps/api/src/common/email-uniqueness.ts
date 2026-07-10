import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Every login email must be unique across BOTH identity tables — the tenant `User`
 * table and the control-plane `PlatformAdmin` table — because `login()` resolves a
 * `User` first, so a tenant user that shares the platform operator's email would
 * silently shadow (and lock out) the operator from the platform console.
 *
 * `PlatformAdmin` is NOT tenant-scoped, so this lookup is global regardless of the
 * current tenant context. Call this before creating any tenant `User`; the
 * `User.email` unique constraint already covers the tenant side.
 */
export async function assertEmailNotPlatformOperator(
  prisma: PrismaService,
  email: string,
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const operator = await prisma.platformAdmin.findUnique({ where: { email: normalized } });
  if (operator) throw new ConflictException('An account with this email already exists');
}
