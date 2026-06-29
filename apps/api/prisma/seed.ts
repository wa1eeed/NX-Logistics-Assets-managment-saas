/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSIONS, ROLES, RoleName, SETTING_DEFS, OrgUnitKind, DEFAULT_ENABLED_MODULES, DEFAULT_MAX_USER_COUNT, DEFAULT_MAX_STORAGE_BYTES, DEFAULT_PLAN_NAME, PLAN_SEED } from '@nx-lam/shared';
import { provisionTenantRoles } from '../src/modules/rbac/provision-roles';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);
const yearsAgo = (n: number) => new Date(Date.now() - n * 365.25 * DAY);

// ---------------------------------------------------------------- real fleet fixture
interface RealAsset {
  code: string; chassis: string | null; type: string; classification: string;
  brand: string | null; year: number | null; color: string | null; capacity: string | null;
  plate: string | null; status: string; project: string | null; region: string | null;
}
const REAL_FLEET: RealAsset[] = JSON.parse(readFileSync(join(__dirname, 'fixtures/real-assets.json'), 'utf-8'));

// تصنيف الملف → صنف المنصّة (مركبة/معدة/ملحق) حسب تعليمات العميل
const CLASS_OF: Record<string, 'VEHICLE' | 'EQUIPMENT' | 'ATTACHMENT'> = {
  'شاحنات ثقيلة': 'VEHICLE', 'شاحنات خفيفة': 'VEHICLE', 'حافلة كبيرة': 'VEHICLE',
  'حافلة صغيرة': 'VEHICLE', 'سيارة إسعاف': 'VEHICLE', 'سيارة إطفاء': 'VEHICLE',
  'معدات ثقيلة': 'EQUIPMENT', 'معدات خدمية': 'EQUIPMENT',
  'ملحقات': 'ATTACHMENT',
};
const classOf = (c: string) => CLASS_OF[c] ?? 'EQUIPMENT';
const STATUS_OF: Record<string, string> = { 'عاملة': 'AVAILABLE', 'متوقفة': 'OUT_OF_SERVICE', 'متوقفة للإصلاح': 'UNDER_MAINTENANCE' };
const meterOf = (cls: string) => (cls === 'VEHICLE' ? 'KM' : cls === 'EQUIPMENT' ? 'HOURS' : 'NONE');

// حقول مخصّصة تجريبية لبعض أنواع المعدات (يضيف الأدمن المزيد لاحقاً)
const CUSTOM_FIELDS: Record<string, unknown[]> = {
  'مولد كهرباء': [{ key: 'kva', labelEn: 'Power (kVA)', labelAr: 'القدرة (kVA)', type: 'NUMBER' }, { key: 'fuel', labelEn: 'Fuel', labelAr: 'الوقود', type: 'SELECT', options: ['ديزل', 'بنزين'] }],
  'ماكينة لحام': [{ key: 'amperage', labelEn: 'Amperage (A)', labelAr: 'الأمبير (A)', type: 'NUMBER' }],
  'تانك مياه': [{ key: 'liters', labelEn: 'Capacity (L)', labelAr: 'السعة (لتر)', type: 'NUMBER' }],
  'كمبروسر هواء': [{ key: 'bar', labelEn: 'Pressure (bar)', labelAr: 'الضغط (bar)', type: 'NUMBER' }],
};

// ---------------------------------------------------------------- infra

async function seedPermissions() {
  for (const p of PERMISSIONS) await prisma.permission.upsert({ where: { key: p.key }, create: { key: p.key }, update: {} });
  console.log(`  ✓ permissions: ${PERMISSIONS.length}`);
}

async function seedPlans() {
  for (const p of PLAN_SEED) {
    await prisma.plan.upsert({
      where: { name: p.name },
      create: {
        name: p.name, seats: p.seats, storageGb: p.storageGb, features: (p.features ?? {}) as object,
        priceMonthly: p.priceMonthly, perVehiclePrice: p.perVehiclePrice ?? null,
        assetCap: p.assetCap ?? null, sortOrder: p.sortOrder ?? 0,
      },
      update: {
        seats: p.seats, storageGb: p.storageGb, features: (p.features ?? {}) as object,
        priceMonthly: p.priceMonthly, perVehiclePrice: p.perVehiclePrice ?? null,
        assetCap: p.assetCap ?? null, sortOrder: p.sortOrder ?? 0,
      },
    });
  }
  console.log(`  ✓ plans: ${PLAN_SEED.length} (plan catalog)`);
}

// Roles are now PER-TENANT — provisioned via the shared provisionTenantRoles helper
// (see src/modules/rbac/provision-roles.ts), called from main() with the tenant id.

async function seedOrg() {
  const mk = async (name: string, kind: OrgUnitKind, parentId: string | null) => {
    const found = await prisma.orgUnit.findFirst({ where: { name } });
    return found ?? prisma.orgUnit.create({ data: { name, kind, parentId } });
  };
  const division = await mk('Logistics Division', OrgUnitKind.DIVISION, null);
  const assetMgmt = await mk('Asset Management Dept', OrgUnitKind.DEPARTMENT, division.id);
  await mk('Registration & Documentation Unit', OrgUnitKind.DEPARTMENT, assetMgmt.id);
  await mk('Performance & Planning Unit', OrgUnitKind.DEPARTMENT, assetMgmt.id);
  const rentalUnit = await mk('Rental & Contracts Unit', OrgUnitKind.DEPARTMENT, assetMgmt.id);
  await mk('Customer Service Unit', OrgUnitKind.DEPARTMENT, assetMgmt.id);
  const maintDept = await mk('Maintenance Dept', OrgUnitKind.DEPARTMENT, division.id);
  const projDept = await mk('Projects Dept', OrgUnitKind.DEPARTMENT, division.id);
  const alpha = await mk('Project Alpha — Riyadh', OrgUnitKind.PROJECT, projDept.id);
  const beta = await mk('Project Beta — Jeddah', OrgUnitKind.PROJECT, projDept.id);
  console.log('  ✓ org units: division + 3 departments + 4 units + 2 projects');
  return { assetMgmt, rentalUnit, maintDept, alpha, beta };
}

async function seedLookups() {
  // Derive reference lists from the REAL fleet (regions, brands, classifications).
  const uniq = (vals: (string | null | undefined)[]) => [...new Set(vals.filter((v): v is string => !!v && v.trim().length > 0))].sort();
  const sets: Record<string, string[]> = {
    REGION: uniq(REAL_FLEET.map((r) => r.region)),
    MANUFACTURER: uniq(REAL_FLEET.map((r) => r.brand)),
    ASSET_CATEGORY: uniq(REAL_FLEET.map((r) => r.classification)),
  };
  for (const [type, items] of Object.entries(sets)) {
    let i = 0;
    for (const val of items) {
      const exL = await prisma.lookup.findFirst({ where: { type, value: val } });
      if (exL) await prisma.lookup.update({ where: { id: exL.id }, data: { labelEn: val, labelAr: val, sortOrder: i } });
      else await prisma.lookup.create({ data: { type, value: val, labelEn: val, labelAr: val, sortOrder: i } });
      i++;
    }
  }
  console.log(`  ✓ lookups: ${sets.REGION.length} regions, ${sets.MANUFACTURER.length} brands, ${sets.ASSET_CATEGORY.length} categories (from real data)`);
}

const ASSET_CLASSES = [
  { code: 'VEHICLE', labelEn: 'Vehicles', labelAr: 'مركبات', fieldProfile: 'VEHICLE', sortOrder: 1 },
  { code: 'EQUIPMENT', labelEn: 'Equipment', labelAr: 'معدات', fieldProfile: 'EQUIPMENT', sortOrder: 2 },
  { code: 'ATTACHMENT', labelEn: 'Attachments', labelAr: 'ملحقات', fieldProfile: 'EQUIPMENT', sortOrder: 3 },
];


async function seedAssetClasses() {
  for (const c of ASSET_CLASSES) {
    const ex = await prisma.assetClass.findFirst({ where: { code: c.code } });
    if (ex) await prisma.assetClass.update({ where: { id: ex.id }, data: { labelEn: c.labelEn, labelAr: c.labelAr, fieldProfile: c.fieldProfile, sortOrder: c.sortOrder } });
    else await prisma.assetClass.create({ data: c });
  }
  console.log(`  ✓ asset classes: ${ASSET_CLASSES.length}`);
  const all = await prisma.assetClass.findMany({ select: { id: true, code: true } });
  return new Map(all.map((c) => [c.code, c.id]));
}

async function seedAssetTypes(classId: Map<string, string>) {
  // Distinct types from the real fleet, each mapped to its classification → class.
  const typeClassif = new Map<string, string>();
  for (const r of REAL_FLEET) if (!typeClassif.has(r.type)) typeClassif.set(r.type, r.classification);

  for (const [name, classification] of typeClassif) {
    const cls = classOf(classification);
    const assetClassId = classId.get(cls) ?? null;
    const unit = cls === 'VEHICLE' ? 'km' : cls === 'EQUIPMENT' ? 'hours' : null;
    const customFields = (CUSTOM_FIELDS[name] ?? null) as object | null;
    const data = { category: classification, unit, assetClassId, customFields: customFields ?? undefined };
    const exT = await prisma.assetType.findFirst({ where: { name } });
    if (exT) await prisma.assetType.update({ where: { id: exT.id }, data });
    else await prisma.assetType.create({ data: { name, ...data } });
  }
  console.log(`  ✓ asset types: ${typeClassif.size} (from real data, mapped to classes + custom fields)`);
  const all = await prisma.assetType.findMany({ select: { id: true, name: true } });
  return new Map(all.map((t) => [t.name, t.id]));
}

async function seedSettings() {
  for (const def of SETTING_DEFS) await prisma.setting.upsert({ where: { key: def.key }, create: { key: def.key, value: def.defaultValue as object, group: def.group }, update: {} });
  console.log(`  ✓ settings: ${SETTING_DEFS.length}`);
}

async function user(email: string, fullName: string, password: string, roleName: string, orgUnitId: string | null) {
  // Roles are per-tenant; in the seed (single tenant, no ALS scope) findFirst by name resolves it.
  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) throw new Error(`role ${roleName} missing`);
  const passwordHash = await argon2.hash(password);
  const u = await prisma.user.upsert({ where: { email: email.toLowerCase() }, create: { email: email.toLowerCase(), fullName, passwordHash, isActive: true }, update: { fullName } });
  const exists = await prisma.userRole.findFirst({ where: { userId: u.id, roleId: role.id, orgUnitId } });
  if (!exists) await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, orgUnitId } });
  return u;
}

// ---------------------------------------------------------------- coherent fleet + operations

/** Bulk-import the real fleet from the fixture (fast createMany; idempotent on empty DB). */
async function seedRealFleet(typeId: Map<string, string>) {
  const now = new Date();
  const rows = REAL_FLEET.map((r) => {
    const cls = classOf(r.classification);
    return {
      code: r.code,
      assetTypeId: typeId.get(r.type)!,
      ownershipType: 'OWNED' as const,
      status: (STATUS_OF[r.status] ?? 'AVAILABLE') as never,
      category: r.classification,
      serialNo: r.chassis,
      capacity: r.capacity,
      color: r.color,
      manufacturer: r.brand,
      model: r.capacity ?? r.brand,
      year: r.year,
      region: r.region,
      siteName: r.project,
      meterType: meterOf(cls),
      currentMeter: 0,
      forSaleFlag: false,
      commissionedAt: r.year ? yearsAgo(Math.max(0, now.getFullYear() - r.year)) : now,
    };
  });
  if ((await prisma.asset.count()) === 0) {
    const B = 500;
    for (let i = 0; i < rows.length; i += B) await prisma.asset.createMany({ data: rows.slice(i, i + B) as never });
  }
  const created = await prisma.asset.findMany({ select: { id: true, code: true, assetTypeId: true } });
  const idByCode = new Map(created.map((a) => [a.code, a.id]));
  if ((await prisma.vehicleDetail.count()) === 0) {
    const vrows = REAL_FLEET
      .filter((r) => classOf(r.classification) === 'VEHICLE' && idByCode.get(r.code))
      .map((r) => ({ assetId: idByCode.get(r.code)!, plateNumber: r.plate, vin: r.chassis }));
    const B = 500;
    for (let i = 0; i < vrows.length; i += B) await prisma.vehicleDetail.createMany({ data: vrows.slice(i, i + B) });
  }
  console.log(`  ✓ real fleet: ${created.length} assets imported`);
  return new Map(created.map((x) => [x.code, x]));
}


async function seedOperations(ctx: { rentalUnit: { id: string }; maintDept: { id: string }; alpha: { id: string }; beta: { id: string } }, admin: { id: string }, approver: { id: string }) {
  // Pick assets dynamically from the imported real fleet (by class).
  const classes = await prisma.assetClass.findMany({ select: { id: true, code: true } });
  const codeById = new Map(classes.map((c) => [c.id, c.code]));
  const pool = await prisma.asset.findMany({
    where: { deletedAt: null, status: 'AVAILABLE' },
    select: { id: true, code: true, assetTypeId: true, assetType: { select: { assetClassId: true } } },
    orderBy: { code: 'asc' }, take: 800,
  });
  const byClass = (cls: string) => pool.filter((a) => codeById.get(a.assetType.assetClassId ?? '') === cls);
  const vehicles = byClass('VEHICLE');
  const equipment = byClass('EQUIPMENT');

  // ---- Active rental contracts on real vehicles → projects/custody ----
  if ((await prisma.rentalContract.count()) === 0 && vehicles.length >= 4) {
    const defs = [
      { a: vehicles[0], project: ctx.alpha, startAgo: 25, end: 10, rate: 18000, receipt: true },
      { a: vehicles[1], project: ctx.beta, startAgo: 40, end: 65, rate: 17000 },
      { a: vehicles[2], project: ctx.alpha, startAgo: 15, end: 80, rate: 9000 },
      { a: vehicles[3], project: ctx.beta, startAgo: 10, end: 50, rate: 22000 },
    ];
    let n = 0;
    for (const c of defs) {
      n += 1;
      const request = await prisma.equipmentRequest.create({ data: { refNo: `REQ-2026-${String(n).padStart(4, '0')}`, orgUnitId: c.project.id, assetTypeId: c.a.assetTypeId, fromDate: yearsAgo(0.1), toDate: daysFromNow(c.end), status: 'FULFILLED', requestedBy: admin.id, reservedAssetId: c.a.id, decidedBy: admin.id } });
      const contract = await prisma.rentalContract.create({ data: { authorizationNo: `AUTH-2026-${String(n).padStart(4, '0')}`, assetId: c.a.id, orgUnitId: c.project.id, requestId: request.id, startDate: daysFromNow(-c.startAgo), endDate: daysFromNow(c.end), status: 'ACTIVE', internalRate: c.rate, approvedBy: admin.id } });
      await prisma.asset.update({ where: { id: c.a.id }, data: { status: 'IN_DUTY', currentOrgUnitId: c.project.id } });
      if (c.receipt) await prisma.handoverInspection.create({ data: { contractId: contract.id, kind: 'RECEIPT', checklist: [{ key: 'tires', condition: 'GOOD' }, { key: 'body', condition: 'GOOD' }, { key: 'engine', condition: 'GOOD' }], odometer: 42000, photos: [], signedBy: 'Dispatch Operator', signedByRole: 'DISPATCH', signedById: admin.id, ip: '127.0.0.1', signedAt: daysFromNow(-c.startAgo) } });
    }
  }

  // ---- Pending + approved requests (dispatch queue + acquisition signal) ----
  if ((await prisma.equipmentRequest.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } })) === 0 && equipment.length >= 3) {
    await prisma.equipmentRequest.create({ data: { refNo: 'REQ-2026-0101', orgUnitId: ctx.alpha.id, assetTypeId: equipment[0].assetTypeId, fromDate: daysFromNow(3), toDate: daysFromNow(60), status: 'PENDING', requestedBy: admin.id, notes: 'مطلوب لأعمال الأساسات', createdAt: daysFromNow(-20) } });
    await prisma.equipmentRequest.create({ data: { refNo: 'REQ-2026-0102', orgUnitId: ctx.beta.id, assetTypeId: equipment[1].assetTypeId, fromDate: daysFromNow(5), toDate: daysFromNow(40), status: 'PENDING', requestedBy: admin.id, notes: 'للوردية الليلية' } });
    const r = equipment[2];
    await prisma.equipmentRequest.create({ data: { refNo: 'REQ-2026-0103', orgUnitId: ctx.alpha.id, assetTypeId: r.assetTypeId, fromDate: daysFromNow(2), toDate: daysFromNow(45), status: 'APPROVED', requestedBy: admin.id, reservedAssetId: r.id, decidedBy: admin.id } });
    await prisma.asset.update({ where: { id: r.id }, data: { status: 'RESERVED' } });
  }

  // ---- Maintenance: 1 open + 2 closed on real equipment ----
  if ((await prisma.maintenanceWorkOrder.count()) === 0 && equipment.length >= 3) {
    let n = 0;
    n += 1;
    const o1 = await prisma.maintenanceWorkOrder.create({ data: { refNo: `WO-2026-${String(n).padStart(4, '0')}`, assetId: equipment[0].id, source: 'BREAKDOWN', type: 'CORRECTIVE', status: 'IN_PROGRESS', priority: 'High', description: 'عطل في المضخة الهيدروليكية' } });
    await prisma.maintenanceCard.create({ data: { workOrderId: o1.id, worksDone: 'تشخيص المضخة وطلب القطعة البديلة', parts: [{ name: 'مضخة هيدروليكية', quantity: 1, cost: 4200 }], technician: 'ورشة أ', laborHours: 6 } });
    for (const eq of [equipment[1], equipment[2]]) {
      n += 1;
      const o = await prisma.maintenanceWorkOrder.create({ data: { refNo: `WO-2026-${String(n).padStart(4, '0')}`, assetId: eq.id, source: 'PERIODIC', type: 'PREVENTIVE', status: 'CLOSED', priority: 'Medium', description: 'صيانة دورية مجدولة', totalCost: 2400, openedAt: daysFromNow(-40), closedAt: daysFromNow(-35) } });
      await prisma.maintenanceCard.create({ data: { workOrderId: o.id, worksDone: 'زيوت وفلاتر وفحص', parts: [], technician: 'ورشة ب', laborHours: 4 } });
    }
  }

  // ---- Sale orders on real equipment ----
  if ((await prisma.saleOrder.count()) === 0 && equipment.length >= 5) {
    await prisma.saleOrder.create({ data: { refNo: 'SALE-2026-0001', assetId: equipment[3].id, status: 'LISTED', askingPrice: 40000, proposedBy: admin.id, approvedBy: approver.id, listedAt: daysFromNow(-10) } });
    await prisma.asset.update({ where: { id: equipment[3].id }, data: { status: 'FOR_SALE', forSaleFlag: true } });
    await prisma.saleOrder.create({ data: { refNo: 'SALE-2026-0002', assetId: equipment[4].id, status: 'PROPOSED', askingPrice: 150000, proposedBy: admin.id } });
  }

  // ---- Suppliers + external leases ----
  const gulf = await prisma.supplier.upsert({ where: { id: 'seed-supplier-gulf' }, create: { id: 'seed-supplier-gulf', name: 'تأجير معدات الخليج', dealType: 'RENTAL', contact: { phone: '+966500000000' } }, update: {} });
  const najd = await prisma.supplier.upsert({ where: { id: 'seed-supplier-najd' }, create: { id: 'seed-supplier-najd', name: 'نجد للمعدات الثقيلة', dealType: 'BOTH', contact: { phone: '+966555555555' } }, update: {} });
  if ((await prisma.externalLeaseContract.count()) === 0 && equipment.length >= 7) {
    const lz: [{ id: string }, string, string][] = [[equipment[5], gulf.id, 'COMPANY'], [equipment[6], najd.id, 'SUPPLIER']];
    let l = 0;
    for (const [eq, sup, maint] of lz) {
      l += 1;
      await prisma.externalLeaseContract.create({ data: { refNo: `LEASE-2026-${String(l).padStart(4, '0')}`, assetId: eq.id, supplierId: sup, periodicRate: 12000, ratePeriod: 'MONTHLY', startDate: daysFromNow(-30), endDate: daysFromNow(40), maintenanceBearer: maint, insuranceBearer: 'SUPPLIER', returnObligation: true } });
    }
  }

  // ---- Drivers assigned to real vehicles (license expiry → alert) ----
  if ((await prisma.driver.count()) === 0 && vehicles.length >= 2) {
    const d1 = await prisma.driver.create({ data: { fullName: 'محمود عادل', iqamaNumber: '2412345678', licenseExpiry: daysFromNow(90), iqamaExpiry: daysFromNow(220) } });
    const d2 = await prisma.driver.create({ data: { fullName: 'سمير خان', iqamaNumber: '2498765432', licenseExpiry: daysFromNow(12), iqamaExpiry: daysFromNow(40) } });
    await prisma.vehicleDetail.updateMany({ where: { assetId: vehicles[0].id }, data: { currentDriverId: d1.id } });
    await prisma.vehicleDetail.updateMany({ where: { assetId: vehicles[1].id }, data: { currentDriverId: d2.id } });
  }

  console.log('  ✓ operations: contracts + requests + work orders + sales + leases + drivers (on real assets)');
}

async function seedTenant() {
  const slug = process.env.SEED_TENANT_SLUG ?? 'alrawaf';
  const name = process.env.SEED_TENANT_NAME ?? 'شركة الرواف';
  const tenant = await prisma.tenant.upsert({ where: { slug }, create: { slug, name, status: 'ACTIVE', code: 'TNT-0001' }, update: { name, code: 'TNT-0001' } });
  // Default subscription / guardrails (managed by the platform admin later).
  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      planName: DEFAULT_PLAN_NAME,
      status: 'ACTIVE',
      maxUserCount: DEFAULT_MAX_USER_COUNT,
      maxStorageBytes: BigInt(DEFAULT_MAX_STORAGE_BYTES),
      enabledModules: DEFAULT_ENABLED_MODULES,
      seatPriceMonthly: 49,
      walletBalance: 1000, // demo starting credit
    },
    // seed = reset to a known baseline (clears demo purchases on re-seed)
    update: {
      planName: DEFAULT_PLAN_NAME,
      maxUserCount: DEFAULT_MAX_USER_COUNT,
      maxStorageBytes: BigInt(DEFAULT_MAX_STORAGE_BYTES),
      enabledModules: DEFAULT_ENABLED_MODULES,
      seatPriceMonthly: 49,
      walletBalance: 1000,
    },
  });
  // Reset the wallet ledger so it matches the baseline balance on re-seed.
  await prisma.walletTransaction.deleteMany({ where: { tenantId: tenant.id } });
  console.log(`  ✓ tenant: ${tenant.name} (${tenant.slug}) · ${tenant.code} + subscription (${DEFAULT_PLAN_NAME})`);
  return tenant;
}

/** Stamp every tenant-scoped row that has no tenant yet with the default tenant. */
async function backfillTenant(tenantId: string) {
  const where = { tenantId: null };
  const data = { tenantId };
  await Promise.all([
    prisma.user.updateMany({ where, data }),
    prisma.userRole.updateMany({ where, data }),
    prisma.orgUnit.updateMany({ where, data }),
    prisma.assetType.updateMany({ where, data }),
    prisma.assetClass.updateMany({ where, data }),
    prisma.model.updateMany({ where, data }),
    prisma.asset.updateMany({ where, data }),
    prisma.vehicleDetail.updateMany({ where, data }),
    prisma.driver.updateMany({ where, data }),
    prisma.document.updateMany({ where, data }),
    prisma.equipmentRequest.updateMany({ where, data }),
    prisma.rentalContract.updateMany({ where, data }),
    prisma.handoverInspection.updateMany({ where, data }),
    prisma.maintenanceWorkOrder.updateMany({ where, data }),
    prisma.maintenanceCard.updateMany({ where, data }),
    prisma.maintenancePlan.updateMany({ where, data }),
    prisma.meterReading.updateMany({ where, data }),
    prisma.saleOrder.updateMany({ where, data }),
    prisma.supplier.updateMany({ where, data }),
    prisma.externalLeaseContract.updateMany({ where, data }),
    prisma.lookup.updateMany({ where, data }),
    prisma.setting.updateMany({ where, data }),
    prisma.auditLog.updateMany({ where, data }),
  ]);
  // Assign per-tenant human user codes (USR-NNNN) to any user missing one.
  const users = await prisma.user.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' }, select: { id: true, code: true } });
  let n = 0;
  for (const u of users) {
    n += 1;
    if (!u.code) await prisma.user.update({ where: { id: u.id }, data: { code: `USR-${String(n).padStart(4, '0')}` } });
  }
  console.log('  ✓ backfilled tenantId + user codes on all existing rows');
}

/** Preventive maintenance plans on real assets (some overdue/due-soon for the compliance demo). */
async function seedPreventive() {
  const plan = async (assetId: string, name: string, intervalType: string, intervalValue: number, lastServiceMeter: number | null, daysAgo: number) => {
    const exists = await prisma.maintenancePlan.findFirst({ where: { assetId, name } });
    const data = { assetId, name, intervalType, intervalValue, lastServiceMeter, lastServiceAt: daysFromNow(-daysAgo) };
    if (exists) await prisma.maintenancePlan.update({ where: { id: exists.id }, data });
    else await prisma.maintenancePlan.create({ data });
  };
  const km = await prisma.asset.findFirst({ where: { meterType: 'KM', deletedAt: null }, orderBy: { code: 'asc' } });
  const hrs = await prisma.asset.findFirst({ where: { meterType: 'HOURS', deletedAt: null }, orderBy: { code: 'asc' } });
  if (km) {
    await prisma.asset.update({ where: { id: km.id }, data: { currentMeter: 12000, meterUpdatedAt: daysFromNow(-3) } });
    await plan(km.id, 'تغيير الزيت', 'KM', 10000, 0, 60);       // 12000 used → overdue
    await plan(km.id, 'فحص السلامة الدوري', 'DAYS', 90, null, 100); // 100d ago → overdue
  }
  if (hrs) {
    await prisma.asset.update({ where: { id: hrs.id }, data: { currentMeter: 300, meterUpdatedAt: daysFromNow(-3) } });
    await plan(hrs.id, 'صيانة كل 250 ساعة', 'HOURS', 250, 0, 120); // 300h → overdue
  }
  console.log('  ✓ preventive: maintenance plans on real assets (overdue/due-soon demo)');
}

async function main() {
  console.log('Seeding NX-LAM (coherent dataset) …');
  const tenant = await seedTenant();
  await seedPermissions();
  await seedPlans();
  await provisionTenantRoles(prisma, tenant.id);
  console.log(`  ✓ roles: ${ROLES.length - 1} per-tenant (excl. platform role)`);
  const org = await seedOrg();
  await seedLookups();
  const classId = await seedAssetClasses();
  const typeId = await seedAssetTypes(classId);
  await seedSettings();

  // Users (all created by super admin; super-admin-only onboarding)
  const admin = await user(process.env.SEED_ADMIN_EMAIL ?? 'admin@nx-lam.local', process.env.SEED_ADMIN_NAME ?? 'System Administrator', process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345', RoleName.SUPER_ADMIN, null);
  await user('pm@nx-lam.local', 'PM — Project Alpha', 'Pm@12345', RoleName.PROJECT_MANAGER, org.alpha.id);
  await user('pm.beta@nx-lam.local', 'PM — Project Beta', 'Pm@12345', RoleName.PROJECT_MANAGER, org.beta.id);
  await user('asset.manager@nx-lam.local', 'Asset Dept Manager', 'Staff@12345', RoleName.DEPT_MANAGER, org.assetMgmt.id);
  await user('dispatch@nx-lam.local', 'Dispatch Operator', 'Staff@12345', RoleName.DISPATCH, org.rentalUnit.id);
  await user('registrar@nx-lam.local', 'Registration Operator', 'Staff@12345', RoleName.UNIT_OPERATOR, org.assetMgmt.id);
  const approver = await user('approver@nx-lam.local', 'Sales Approver', 'Staff@12345', RoleName.UNIT_APPROVER, org.assetMgmt.id);
  await user('tech@nx-lam.local', 'Maintenance Technician', 'Staff@12345', RoleName.MAINTENANCE, org.maintDept.id);
  console.log('  ✓ users: 8 (super-admin-onboarded, department-scoped)');

  await seedRealFleet(typeId);
  await seedOperations(org, admin, approver);
  await seedPreventive();
  await backfillTenant(tenant.id);

  // Platform/SaaS operator — Control-Plane identity in its OWN table (PlatformAdmin),
  // deliberately NOT a tenant User, so a tenant-side compromise can't reach it.
  const platformEmail = (process.env.SEED_PLATFORM_EMAIL ?? 'platform@nx-lam.local').toLowerCase();
  const platformHash = await argon2.hash(process.env.SEED_PLATFORM_PASSWORD ?? 'Platform@12345');
  await prisma.platformAdmin.upsert({
    where: { email: platformEmail },
    create: { email: platformEmail, fullName: 'Platform Operator', passwordHash: platformHash, isActive: true },
    update: { fullName: 'Platform Operator' },
  });
  console.log(`  ✓ platform operator: ${platformEmail} (PlatformAdmin table, above all tenants)`);
  console.log('Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
