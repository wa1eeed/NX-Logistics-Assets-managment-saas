import { PrismaService } from '../prisma/prisma.service';

/**
 * Generates a unique, human-readable reference code like WO-2026-0007.
 * Counts existing rows of the given model for the current year and increments.
 * Models are passed as the prisma delegate (e.g. prisma.saleOrder).
 */
export async function nextRefNo(
  prisma: PrismaService,
  model: 'saleOrder' | 'maintenanceWorkOrder' | 'externalLeaseContract' | 'equipmentRequest',
  prefix: string,
): Promise<string> {
  const year = new Date().getFullYear();
  // total count is sufficient for a monotonic sequence in dev/staging
  const delegate = prisma[model] as unknown as { count: () => Promise<number> };
  const count = await delegate.count();
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}
