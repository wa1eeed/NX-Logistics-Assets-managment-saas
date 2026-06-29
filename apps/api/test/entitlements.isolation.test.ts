/**
 * Tenant-isolation tests for the SaaS Entitlements engine.
 *
 * Runs against the real dev database so the Prisma tenant-scoping middleware is
 * genuinely exercised (the actual isolation boundary). Validates that Tenant A
 * cannot consume Tenant B's storage space, cannot read B's subscription, and
 * that each tenant's user/storage/module guardrails are enforced independently.
 *
 * Run:  pnpm --filter api test
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { PrismaService } from '../src/prisma/prisma.service';
import { EntitlementsService } from '../src/modules/entitlements/entitlements.service';
import { tenantContext } from '../src/common/tenant/tenant-context';

const prisma = new PrismaService();
const svc = new EntitlementsService(prisma);

const STAMP = Date.now();
const A_SLUG = `test-iso-a-${STAMP}`;
const B_SLUG = `test-iso-b-${STAMP}`;
let tenantA = '';
let tenantB = '';

/** Execute `fn` inside a given tenant's request context (drives the middleware). */
function asTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    tenantContext.run({ tenantId }, () => {
      fn().then(resolve, reject);
    });
  });
}

before(async () => {
  await prisma.$connect();

  const a = await prisma.tenant.create({ data: { slug: A_SLUG, code: `TST-A-${STAMP}`, name: 'Isolation Tenant A', status: 'ACTIVE' } });
  const b = await prisma.tenant.create({ data: { slug: B_SLUG, code: `TST-B-${STAMP}`, name: 'Isolation Tenant B', status: 'ACTIVE' } });
  tenantA = a.id;
  tenantB = b.id;

  // A: tight caps + disposal disabled. B: generous caps + all modules on.
  await prisma.tenantSubscription.create({
    data: { tenantId: tenantA, planName: 'STARTER', status: 'ACTIVE', maxUserCount: 2, maxStorageBytes: BigInt(100), enabledModules: { disposal: false, rentals: true } },
  });
  await prisma.tenantSubscription.create({
    data: { tenantId: tenantB, planName: 'ENTERPRISE', status: 'ACTIVE', maxUserCount: 50, maxStorageBytes: BigInt(1_000_000_000), enabledModules: { disposal: true, rentals: true } },
  });

  // Storage ledger: A holds 60 bytes, B holds 500,000 bytes. Created inside each
  // tenant's context so the middleware stamps tenantId (proves stamping works).
  await asTenant(tenantA, () => prisma.storageObject.create({ data: { key: `${tenantA}/assets/x/a.bin`, sizeBytes: BigInt(60), module: 'assets' } }));
  await asTenant(tenantB, () => prisma.storageObject.create({ data: { key: `${tenantB}/assets/y/b.bin`, sizeBytes: BigInt(500_000), module: 'assets' } }));

  // Users: fill A to its cap of 2; give B one user.
  const hash = '$argon2id$test'; // not validated here, just a placeholder
  await asTenant(tenantA, () => prisma.user.create({ data: { email: `a1-${STAMP}@iso.test`, fullName: 'A One', passwordHash: hash } }));
  await asTenant(tenantA, () => prisma.user.create({ data: { email: `a2-${STAMP}@iso.test`, fullName: 'A Two', passwordHash: hash } }));
  await asTenant(tenantB, () => prisma.user.create({ data: { email: `b1-${STAMP}@iso.test`, fullName: 'B One', passwordHash: hash } }));
});

after(async () => {
  // Clean up everything we created (unscoped deletes by tenantId).
  for (const t of [tenantA, tenantB]) {
    if (!t) continue;
    await prisma.storageObject.deleteMany({ where: { tenantId: t } });
    await prisma.user.deleteMany({ where: { tenantId: t } });
    await prisma.tenantSubscription.deleteMany({ where: { tenantId: t } });
    await prisma.tenant.delete({ where: { id: t } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe('Entitlements — tenant isolation', () => {
  it('storage usage is counted per-tenant (A sees only its own bytes)', async () => {
    const aBytes = await asTenant(tenantA, () => svc.currentStorageBytes());
    const bBytes = await asTenant(tenantB, () => svc.currentStorageBytes());
    assert.equal(aBytes, 60, 'A must see exactly its own 60 bytes');
    assert.equal(bBytes, 500_000, 'B must see exactly its own 500,000 bytes');
  });

  it('Tenant A cannot consume Tenant B free space (cap is A-local)', async () => {
    await asTenant(tenantA, async () => {
      // A used 60 of 100. +50 → 110 > 100 → must reject, even though B has ~1GB free.
      await assert.rejects(() => svc.assertStorageAvailable(50), /Storage quota exceeded/);
      // +30 → 90 ≤ 100 → allowed.
      await svc.assertStorageAvailable(30);
    });
    // B with the same +50 is fine — proves the cap did not borrow from B.
    await asTenant(tenantB, () => svc.assertStorageAvailable(50));
  });

  it('reading B storage from A context never leaks B usage', async () => {
    // currentStorageBytes ignores the explicit id while in-context and stays scoped.
    const fromA = await asTenant(tenantA, () => svc.currentStorageBytes(tenantB));
    assert.equal(fromA, 60, 'A context must not expose B\'s 500,000 bytes');
  });

  it('user cap is enforced independently per tenant', async () => {
    await asTenant(tenantA, async () => {
      const count = await svc.activeUserCount();
      assert.equal(count, 2, 'A has exactly 2 users');
      await assert.rejects(() => svc.assertCanAddUser(), /User limit reached/);
    });
    await asTenant(tenantB, async () => {
      assert.equal(await svc.activeUserCount(), 1, 'B has exactly 1 user');
      await svc.assertCanAddUser(); // 1 < 50 → fine
    });
  });

  it('module flags are read from the acting tenant only', async () => {
    await asTenant(tenantA, async () => {
      await assert.rejects(() => svc.assertModuleEnabled('disposal'), /not enabled/);
      await svc.assertModuleEnabled('rentals');
    });
    await asTenant(tenantB, async () => {
      await svc.assertModuleEnabled('disposal'); // enabled for B
    });
  });

  it('subscription config does not leak across tenants', async () => {
    const real = await asTenant(tenantB, () => svc.getEffective());
    assert.equal(real.maxUserCount, 50, 'B truly has a 50-user cap');

    // From A's context, asking for B's subscription must NOT return B's row.
    const leaked = await asTenant(tenantA, () => svc.getEffective(tenantB));
    assert.notEqual(leaked.maxUserCount, 50, 'A context must not read B\'s 50-user cap');
  });

  it('raw Prisma reads are tenant-scoped by the middleware', async () => {
    const aObjs = await asTenant(tenantA, () => prisma.storageObject.findMany());
    const bObjs = await asTenant(tenantB, () => prisma.storageObject.findMany());
    assert.ok(aObjs.every((o) => o.tenantId === tenantA), 'A only sees A objects');
    assert.ok(bObjs.every((o) => o.tenantId === tenantB), 'B only sees B objects');
  });
});
