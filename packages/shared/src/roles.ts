// ============================================================
// Role catalog + default permission grants for the seed.
// Mirrors the personas in docs/01_conception_ar.md §2.
// SUPER_ADMIN is granted the full catalog at seed time.
// ============================================================

export const RoleName = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  ASSET_MANAGER: 'ASSET_MANAGER',
  DISPATCH: 'DISPATCH',
  MAINTENANCE: 'MAINTENANCE',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  // Operations-plan unit archetypes (assigned with an org-unit scope)
  DEPT_MANAGER: 'DEPT_MANAGER',
  UNIT_SUPERVISOR: 'UNIT_SUPERVISOR',
  UNIT_OPERATOR: 'UNIT_OPERATOR',
  UNIT_APPROVER: 'UNIT_APPROVER',
} as const;
export type RoleName = (typeof RoleName)[keyof typeof RoleName];

export interface RoleDef {
  name: RoleName;
  descriptionEn: string;
  descriptionAr: string;
  /** '*' grants every permission in the catalog. */
  permissions: string[] | '*';
}

export const ROLES: RoleDef[] = [
  {
    name: 'PLATFORM_ADMIN',
    descriptionEn: 'SaaS platform operator — manages all tenants (above any single company)',
    descriptionAr: 'مشغّل منصّة الـSaaS — يدير كل الشركات (فوق أي شركة واحدة)',
    // Deliberately NO tenant-data permissions (assets/rentals/…): the platform
    // admin manages the platform and impersonates a tenant to view its data.
    permissions: [
      'platform.tenants.read', 'platform.tenants.manage', 'platform.impersonate',
      'entitlements.manage', 'payments.manage', 'maps.manage',
    ],
  },
  {
    name: 'SUPER_ADMIN',
    descriptionEn: 'Full system administration and oversight',
    descriptionAr: 'إدارة واطّلاع كامل على النظام',
    permissions: '*',
  },
  {
    name: 'ASSET_MANAGER',
    descriptionEn: 'Owns the asset lifecycle and major decisions',
    descriptionAr: 'مسؤول دورة حياة الأصل والقرارات الكبرى',
    permissions: [
      'assets.read', 'assets.create', 'assets.update', 'assets.status',
      'documents.read', 'documents.upload', 'drivers.read', 'drivers.manage',
      'asset_types.read', 'org_units.read',
      'rentals.read', 'maintenance.read',
      'sale.read', 'sale.create', 'sale.approve', 'sale.complete',
      'acquisition.read', 'acquisition.manage', 'suppliers.read', 'suppliers.manage',
      'finance.read', 'kpis.read', 'audit.read',
    ],
  },
  {
    name: 'DISPATCH',
    descriptionEn: 'Transport & rental: issues authorizations/contracts & handover (does not approve — SoD)',
    descriptionAr: 'النقليات والتأجير: يصدر التعميد/العقد والتسليم (لا يعتمد — فصل المهام)',
    permissions: [
      'assets.read', 'asset_types.read', 'org_units.read',
      'rentals.read', 'rentals.contract', 'rentals.extend', 'rentals.return',
      'documents.read', 'drivers.read', 'drivers.manage', 'kpis.read',
    ],
  },
  {
    name: 'MAINTENANCE',
    descriptionEn: 'Maintenance work orders and cards',
    descriptionAr: 'أوامر الصيانة وكروتها',
    permissions: [
      'assets.read', 'asset_types.read',
      'maintenance.read', 'maintenance.create', 'maintenance.card', 'maintenance.close',
      'documents.read', 'documents.upload', 'kpis.read',
    ],
  },
  {
    name: 'PROJECT_MANAGER',
    descriptionEn: 'Requests equipment and manages project custody (scoped)',
    descriptionAr: 'يطلب المعدات ويدير عهدة مشروعه (بنطاق)',
    permissions: [
      'assets.read', 'asset_types.read',
      'rentals.read', 'rentals.request', 'rentals.extend', 'rentals.return',
      'documents.read',
    ],
  },
  {
    name: 'DEPT_MANAGER',
    descriptionEn: 'Department manager — oversight + approvals within the department',
    descriptionAr: 'مدير الإدارة — إشراف واعتمادات ضمن الإدارة',
    permissions: [
      'assets.read', 'asset_types.read', 'org_units.read', 'documents.read', 'drivers.read',
      'rentals.read', 'rentals.approve', 'maintenance.read',
      // Owns disposal + acquisition execution. Sale approval SoD is preserved by the
      // self-approval guard in disposal.service (proposer ≠ approver).
      'sale.read', 'sale.create', 'sale.approve', 'sale.complete',
      'acquisition.read', 'acquisition.manage', 'suppliers.read', 'suppliers.manage',
      'finance.read', 'kpis.read', 'audit.read',
    ],
  },
  {
    name: 'UNIT_SUPERVISOR',
    descriptionEn: 'Unit supervisor — quality control and daily operations',
    descriptionAr: 'مشرف الوحدة — ضبط الجودة والتشغيل اليومي',
    permissions: [
      'assets.read', 'assets.update', 'asset_types.read', 'documents.read', 'documents.upload', 'drivers.read',
      'rentals.read', 'rentals.contract', 'rentals.extend', 'rentals.return',
      'maintenance.read', 'maintenance.card', 'maintenance.close', 'kpis.read',
    ],
  },
  {
    name: 'UNIT_OPERATOR',
    descriptionEn: 'Data-entry / operations staff — registers and documents assets',
    descriptionAr: 'موظف إدخال/تشغيل — تسجيل الأصول وتوثيقها',
    permissions: [
      'assets.read', 'assets.create', 'assets.update', 'asset_types.read',
      'documents.read', 'documents.upload', 'drivers.read', 'drivers.manage',
    ],
  },
  {
    name: 'UNIT_APPROVER',
    descriptionEn: 'Approver — authorizes requests/sales only (segregation of duties)',
    descriptionAr: 'المعتمِد — يعتمد الطلبات/البيع فقط (فصل المهام)',
    permissions: [
      'assets.read', 'rentals.read', 'rentals.approve',
      'sale.read', 'sale.approve', 'maintenance.read', 'kpis.read',
    ],
  },
];

/**
 * Permissions that belong to the platform/SaaS operator, NOT to any tenant.
 * These are excluded from the tenant SUPER_ADMIN's '*' grant so a company
 * admin can never raise their own subscription limits. They will be granted
 * to a dedicated platform-admin role in the SaaS-admin phase.
 */
export const PLATFORM_RESERVED_PERMISSIONS: string[] = [
  'entitlements.manage',
  'platform.tenants.read',
  'platform.tenants.manage',
  'platform.impersonate',
  'payments.manage',
  'maps.manage',
];

/**
 * Roles whose data access is row-level scoped to their assigned org unit(s)
 * (project consumers — they see only their own custody/assets). Every other
 * role is a central/functional department that operates company-wide, so a
 * user holding ANY non-scoped role is treated as global regardless of the
 * org unit recorded on the assignment (which is kept for org-chart membership).
 */
export const SCOPED_ROLES: RoleName[] = [RoleName.PROJECT_MANAGER];
