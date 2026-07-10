// ============================================================
// Permission catalog — single source of truth for RBAC keys.
// The seed provisions exactly these; the API guards + web UI reference them.
// Grouped + bilingual, with a one-line description so the role permission
// matrix clearly explains what each permission allows.
// ============================================================

export interface PermissionDef {
  key: string;
  group: string;
  labelEn: string;
  labelAr: string;
  descEn: string;
  descAr: string;
}

export const PERMISSIONS: PermissionDef[] = [
  // --- Users ---
  { key: 'users.read', group: 'users', labelEn: 'View users', labelAr: 'عرض المستخدمين', descEn: 'See the list of users and their roles.', descAr: 'الاطّلاع على قائمة المستخدمين وأدوارهم.' },
  { key: 'users.create', group: 'users', labelEn: 'Create users', labelAr: 'إنشاء مستخدمين', descEn: 'Add new staff accounts to the company.', descAr: 'إضافة حسابات موظفين جدد للشركة.' },
  { key: 'users.update', group: 'users', labelEn: 'Update users', labelAr: 'تعديل المستخدمين', descEn: 'Edit user details and role assignments.', descAr: 'تعديل بيانات المستخدمين وإسناد الأدوار.' },
  { key: 'users.delete', group: 'users', labelEn: 'Deactivate users', labelAr: 'تعطيل المستخدمين', descEn: 'Disable a user’s access (soft delete).', descAr: 'إيقاف وصول المستخدم (حذف منطقي).' },

  // --- Roles & permissions ---
  { key: 'roles.read', group: 'roles', labelEn: 'View roles', labelAr: 'عرض الأدوار', descEn: 'See roles and their granted permissions.', descAr: 'الاطّلاع على الأدوار وصلاحياتها.' },
  { key: 'roles.manage', group: 'roles', labelEn: 'Manage roles & permissions', labelAr: 'إدارة الأدوار والصلاحيات', descEn: 'Create roles and change which permissions they grant.', descAr: 'إنشاء الأدوار وتغيير صلاحياتها.' },
  { key: 'permissions.read', group: 'roles', labelEn: 'View permission catalog', labelAr: 'عرض كتالوج الصلاحيات', descEn: 'Browse the full catalog of available permissions.', descAr: 'تصفّح كامل كتالوج الصلاحيات المتاحة.' },

  // --- Org units ---
  { key: 'org_units.read', group: 'org_units', labelEn: 'View org units', labelAr: 'عرض الوحدات التنظيمية', descEn: 'See departments, units and projects.', descAr: 'الاطّلاع على الإدارات والوحدات والمشاريع.' },
  { key: 'org_units.manage', group: 'org_units', labelEn: 'Manage org units', labelAr: 'إدارة الوحدات التنظيمية', descEn: 'Create and edit departments, units and projects.', descAr: 'إنشاء وتعديل الإدارات والوحدات والمشاريع.' },

  // --- Reference data ---
  { key: 'asset_types.read', group: 'reference', labelEn: 'View asset types & catalog', labelAr: 'عرض أنواع المعدات والكتالوج', descEn: 'Read asset types, classes and the brand→model catalog.', descAr: 'قراءة أنواع المعدات والأصناف وكتالوج الماركة←الموديل.' },
  { key: 'asset_types.manage', group: 'reference', labelEn: 'Manage asset types & catalog', labelAr: 'إدارة أنواع المعدات والكتالوج', descEn: 'Create/edit asset types, classes and models.', descAr: 'إنشاء/تعديل أنواع المعدات والأصناف والموديلات.' },
  { key: 'settings.read', group: 'reference', labelEn: 'View settings', labelAr: 'عرض الإعدادات', descEn: 'Read platform settings, thresholds and lists.', descAr: 'قراءة إعدادات المنصة والعتبات والقوائم.' },
  { key: 'settings.manage', group: 'reference', labelEn: 'Manage settings & thresholds', labelAr: 'إدارة الإعدادات والعتبات', descEn: 'Change alert thresholds, reference lists and cloud storage.', descAr: 'تغيير عتبات التنبيه والقوائم المرجعية والتخزين السحابي.' },

  // --- Audit ---
  { key: 'audit.read', group: 'audit', labelEn: 'View audit log', labelAr: 'عرض سجل التدقيق', descEn: 'Review the append-only log of every change (who/what/when).', descAr: 'مراجعة سجل التدقيق غير القابل للتعديل لكل تغيير (من/ماذا/متى).' },

  // --- Assets ---
  { key: 'assets.read', group: 'assets', labelEn: 'View assets', labelAr: 'عرض الأصول', descEn: 'See the fleet of vehicles & equipment and their profiles.', descAr: 'الاطّلاع على أسطول المركبات والمعدات وملفّاتها.' },
  { key: 'assets.create', group: 'assets', labelEn: 'Register assets', labelAr: 'تسجيل الأصول', descEn: 'Add new vehicles/equipment to the fleet.', descAr: 'إضافة مركبات/معدات جديدة للأسطول.' },
  { key: 'assets.update', group: 'assets', labelEn: 'Update assets', labelAr: 'تعديل الأصول', descEn: 'Edit asset details, vehicle info and confirm readiness.', descAr: 'تعديل بيانات الأصل ومعلومات المركبة وتأكيد الجاهزية.' },
  { key: 'assets.delete', group: 'assets', labelEn: 'Delete assets', labelAr: 'حذف الأصول', descEn: 'Soft-delete an asset from the fleet.', descAr: 'حذف منطقي لأصل من الأسطول.' },
  { key: 'assets.status', group: 'assets', labelEn: 'Change asset status', labelAr: 'تغيير حالة الأصل', descEn: 'Move an asset through the lifecycle (available, out of service…).', descAr: 'نقل الأصل عبر دورة الحياة (متاح، خارج الخدمة…).' },
  { key: 'documents.read', group: 'assets', labelEn: 'View documents', labelAr: 'عرض المستندات', descEn: 'Open documents attached to assets/contracts.', descAr: 'فتح المستندات المرفقة بالأصول/العقود.' },
  { key: 'documents.upload', group: 'assets', labelEn: 'Upload documents', labelAr: 'رفع المستندات', descEn: 'Attach files (registration, customs, invoices…).', descAr: 'إرفاق ملفات (استمارة، جمارك، فواتير…).' },
  { key: 'drivers.read', group: 'assets', labelEn: 'View drivers', labelAr: 'عرض السائقين', descEn: 'See driver records and their assigned vehicles.', descAr: 'الاطّلاع على سجلات السائقين ومركباتهم المسندة.' },
  { key: 'drivers.manage', group: 'assets', labelEn: 'Manage drivers', labelAr: 'إدارة السائقين', descEn: 'Add/edit drivers and assign them to vehicles.', descAr: 'إضافة/تعديل السائقين وإسنادهم للمركبات.' },

  // --- Rentals / dispatch ---
  { key: 'rentals.read', group: 'rentals', labelEn: 'View rentals', labelAr: 'عرض التأجير', descEn: 'See equipment requests, contracts and custody.', descAr: 'الاطّلاع على طلبات المعدات والعقود والعهدة.' },
  { key: 'rentals.request', group: 'rentals', labelEn: 'Request equipment', labelAr: 'طلب معدة', descEn: 'Raise an equipment request for a project.', descAr: 'رفع طلب معدة لمشروع.' },
  { key: 'rentals.approve', group: 'rentals', labelEn: 'Approve requests', labelAr: 'اعتماد الطلبات', descEn: 'Approve a request and reserve a specific asset (does not issue the contract).', descAr: 'اعتماد الطلب وحجز أصل محدّد (دون إصدار العقد).' },
  { key: 'rentals.contract', group: 'rentals', labelEn: 'Issue authorization & contract', labelAr: 'إصدار التعميد والعقد', descEn: 'Issue the authorization/contract that puts the asset on duty.', descAr: 'إصدار التعميد/العقد الذي يضع الأصل في الخدمة.' },
  { key: 'rentals.extend', group: 'rentals', labelEn: 'Extend contracts', labelAr: 'تمديد العقود', descEn: 'Extend the end date of an active contract.', descAr: 'تمديد تاريخ انتهاء عقد نشط.' },
  { key: 'rentals.return', group: 'rentals', labelEn: 'Return / hand over', labelAr: 'تسليم/استلام', descEn: 'Record handover inspections and return an asset.', descAr: 'تسجيل فحوص التسليم/الاستلام وإرجاع الأصل.' },

  // --- Maintenance ---
  { key: 'maintenance.read', group: 'maintenance', labelEn: 'View work orders', labelAr: 'عرض أوامر الصيانة', descEn: 'See maintenance work orders and cards.', descAr: 'الاطّلاع على أوامر الصيانة وكروتها.' },
  { key: 'maintenance.create', group: 'maintenance', labelEn: 'Open work orders', labelAr: 'فتح أوامر صيانة', descEn: 'Open a new maintenance work order on an asset.', descAr: 'فتح أمر صيانة جديد على أصل.' },
  { key: 'maintenance.card', group: 'maintenance', labelEn: 'Fill maintenance card', labelAr: 'تعبئة كرت الصيانة', descEn: 'Record works done, parts and labour, upload invoices.', descAr: 'تسجيل الأعمال والقطع والعمالة ورفع الفواتير.' },
  { key: 'maintenance.close', group: 'maintenance', labelEn: 'Close work orders', labelAr: 'إغلاق أوامر الصيانة', descEn: 'Close a work order and return the asset to service.', descAr: 'إغلاق أمر الصيانة وإعادة الأصل للخدمة.' },

  // --- Disposal / acquisition ---
  { key: 'sale.read', group: 'lifecycle', labelEn: 'View sale orders', labelAr: 'عرض أوامر البيع', descEn: 'See disposal/sale orders and their status.', descAr: 'الاطّلاع على أوامر البيع/التخلص وحالاتها.' },
  { key: 'sale.create', group: 'lifecycle', labelEn: 'Propose sale', labelAr: 'اقتراح بيع', descEn: 'Propose selling an owned asset.', descAr: 'اقتراح بيع أصل مملوك.' },
  { key: 'sale.approve', group: 'lifecycle', labelEn: 'Approve sale', labelAr: 'اعتماد البيع', descEn: 'Approve a proposed sale (cannot approve own proposal — SoD).', descAr: 'اعتماد بيع مقترَح (لا يعتمد اقتراحه — فصل المهام).' },
  { key: 'sale.complete', group: 'lifecycle', labelEn: 'Complete sale', labelAr: 'إتمام البيع', descEn: 'Record the final sale price/buyer and dispose the asset.', descAr: 'تسجيل سعر البيع/المشتري النهائي والتخلص من الأصل.' },
  { key: 'acquisition.read', group: 'lifecycle', labelEn: 'View acquisitions', labelAr: 'عرض الاستحواذ', descEn: 'See external lease contracts.', descAr: 'الاطّلاع على عقود الاستئجار الخارجي.' },
  { key: 'acquisition.manage', group: 'lifecycle', labelEn: 'Manage acquisitions', labelAr: 'إدارة الاستحواذ', descEn: 'Create/edit external lease contracts.', descAr: 'إنشاء/تعديل عقود الاستئجار الخارجي.' },
  { key: 'suppliers.read', group: 'lifecycle', labelEn: 'View suppliers', labelAr: 'عرض الموردين', descEn: 'See the suppliers directory.', descAr: 'الاطّلاع على دليل الموردين.' },
  { key: 'suppliers.manage', group: 'lifecycle', labelEn: 'Manage suppliers', labelAr: 'إدارة الموردين', descEn: 'Add/edit suppliers and their deal types.', descAr: 'إضافة/تعديل الموردين وأنواع تعاملهم.' },

  // --- Cross-cutting ---
  { key: 'finance.read', group: 'finance', labelEn: 'View financial fields', labelAr: 'عرض الحقول المالية', descEn: 'See purchase price, book value, rates, TCO and other money fields.', descAr: 'رؤية سعر الشراء والقيمة الدفترية والأجور وإجمالي التكلفة والحقول المالية.' },
  { key: 'kpis.read', group: 'kpis', labelEn: 'View KPI dashboards & alerts', labelAr: 'عرض لوحات المؤشرات والتنبيهات', descEn: 'Access the executive fleet dashboard and the alerts centre.', descAr: 'الوصول للوحة الأسطول التنفيذية ومركز التنبيهات.' },

  // --- SaaS subscription / entitlements ---
  { key: 'entitlements.read', group: 'saas', labelEn: 'View subscription & usage', labelAr: 'عرض الاشتراك والاستهلاك', descEn: 'See the company’s plan, resource limits and current usage.', descAr: 'الاطّلاع على باقة الشركة وحدود الموارد والاستهلاك الحالي.' },
  { key: 'entitlements.manage', group: 'saas', labelEn: 'Manage tenant subscriptions (platform)', labelAr: 'إدارة اشتراكات المستأجرين (المنصّة)', descEn: 'Platform-admin only: set tenant storage/user caps and enabled modules.', descAr: 'لأدمن المنصّة فقط: ضبط حدود التخزين/المستخدمين والموديولات المفعّلة للمستأجر.' },
  { key: 'billing.read', group: 'saas', labelEn: 'View billing & wallet', labelAr: 'عرض الفوترة والمحفظة', descEn: 'See the subscription wallet balance and transaction history.', descAr: 'الاطّلاع على رصيد محفظة الاشتراك وسجل الحركات.' },
  { key: 'billing.manage', group: 'saas', labelEn: 'Manage billing (top-up & add-ons)', labelAr: 'إدارة الفوترة (شحن وإضافات)', descEn: 'Top up the wallet and buy extra seats / activate module add-ons.', descAr: 'شحن رصيد المحفظة وشراء مقاعد إضافية / تفعيل إضافات الموديولات.' },

  // --- Platform operator (above all tenants) ---
  { key: 'platform.tenants.read', group: 'platform', labelEn: 'View all tenants (platform)', labelAr: 'عرض كل الشركات (المنصّة)', descEn: 'Platform-admin only: see every subscribing company and its usage.', descAr: 'لأدمن المنصّة فقط: رؤية كل الشركات المشتركة واستهلاكها.' },
  { key: 'platform.tenants.manage', group: 'platform', labelEn: 'Manage tenants (platform)', labelAr: 'إدارة الشركات (المنصّة)', descEn: 'Platform-admin only: onboard, suspend or reactivate companies.', descAr: 'لأدمن المنصّة فقط: إضافة الشركات وتعليقها وإعادة تفعيلها.' },
  { key: 'platform.impersonate', group: 'platform', labelEn: 'Impersonate a tenant (support)', labelAr: 'انتحال شركة (الدعم)', descEn: 'Platform-admin only: sign in as a company’s admin for support.', descAr: 'لأدمن المنصّة فقط: الدخول كمدير شركة لأغراض الدعم.' },
  { key: 'payments.manage', group: 'platform', labelEn: 'Manage payment gateway (platform)', labelAr: 'إدارة بوابة الدفع (المنصّة)', descEn: 'Platform-admin only: configure the Tap payment gateway account (keys, currency).', descAr: 'لأدمن المنصّة فقط: ضبط حساب بوابة الدفع Tap (المفاتيح والعملة).' },
  { key: 'maps.manage', group: 'platform', labelEn: 'Manage maps provider (platform)', labelAr: 'إدارة مزوّد الخرائط (المنصّة)', descEn: 'Platform-admin only: configure the Google Maps API key used by all tenants.', descAr: 'لأدمن المنصّة فقط: ضبط مفتاح خرائط قوقل المستخدَم لكل المستأجرين.' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS: Record<string, { en: string; ar: string }> = {
  users: { en: 'Users', ar: 'المستخدمون' },
  roles: { en: 'Roles & Permissions', ar: 'الأدوار والصلاحيات' },
  org_units: { en: 'Org Units', ar: 'الوحدات التنظيمية' },
  reference: { en: 'Reference Data', ar: 'البيانات المرجعية' },
  audit: { en: 'Audit', ar: 'التدقيق' },
  assets: { en: 'Assets', ar: 'الأصول' },
  rentals: { en: 'Rentals & Dispatch', ar: 'النقليات والتأجير' },
  maintenance: { en: 'Maintenance', ar: 'الصيانة' },
  lifecycle: { en: 'Lifecycle (Sale/Acquisition)', ar: 'دورة الحياة (بيع/استحواذ)' },
  finance: { en: 'Finance', ar: 'المالية' },
  kpis: { en: 'KPIs', ar: 'المؤشرات' },
  saas: { en: 'Subscription (SaaS)', ar: 'الاشتراك (SaaS)' },
  platform: { en: 'Platform (SaaS operator)', ar: 'المنصّة (مشغّل SaaS)' },
};
