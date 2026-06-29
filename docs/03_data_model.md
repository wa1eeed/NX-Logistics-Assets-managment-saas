# 03 — نموذج البيانات وقابلية التوسّع

المخطّط الكامل في `prisma/schema.prisma`. هذا المستند يشرح القرارات المحورية.

> **مُحدَّث (2026-06-28):** أُضيفت طبقة بيانات SaaS كاملة (انظر §8 و[`06_implemented_state.md`](06_implemented_state.md)).

## 1) العمود الفقري للتوسّع: `OrgUnit` الهرمي
بدل تثبيت «المشروع» كطرف وحيد للطلب/العهدة، استخدمنا `OrgUnit` بثلاثة أنواع (`DIVISION` / `DEPARTMENT` / `PROJECT`) مع `parentId`. كل عقد/طلب يرتبط بـ `orgUnitId`. النتيجة:
- إضافة إدارة عليا أو قسم جديد = صف في `org_units`، بلا تعديل كود.
- تقارير العهد تتجمّع هرمياً (مشروع → إدارة → قطاع).
- scoping الصلاحيات يتحدّد بالوحدة (مدير المشروع يرى وحدته وفروعها فقط).

## 2) نوع الملكية يقود التكاليف
`Asset.ownershipType` (`OWNED` / `EXTERNALLY_RENTED`) هو المفتاح المالي:
- **OWNED:** `bookValue` + `depreciationRate` + احتساب الإهلاك → TCO = إهلاك + تشغيل. نهايته `SaleOrder`.
- **EXTERNALLY_RENTED:** لا إهلاك؛ مرتبط بـ `ExternalLeaseContract` (أجرة دورية = OpEx). نهايته **إعادة للمؤجّر**، لا بيع.
- كلا النوعين يُؤجَّر داخلياً على المشاريع بنفس آلية `RentalContract`.

## 3) الحالة محكومة (State Machine)
`Asset.status` لا يُكتب مباشرة؛ يمر عبر `AssetStatusService` التي تتحقّق من الانتقالات المسموحة (راجع §4 في التصوّر). `forSaleFlag` يعالج حالة «أصل مؤجّر يُراد بيعه» فلا يعود للشاغر بعد تسليمه بل ينتقل إلى `FOR_SALE`.

## 4) المستندات عامة وقابلة للتنبيه
`Document` يخدم كل الكيانات (`entityType` + روابط FK صريحة اختيارية) ويحمل `fileKey` (مفتاح R2) و`expiryDate` لتشغيل تنبيهات الانتهاء (استمارة/فحص/رخصة سائق...).

## 5) فصل المهام مرصود في البيانات
حقول مثل `requestedBy` / `approvedBy` / `proposedBy` / `closedBy` تثبّت من فعل ماذا، وتدعم قاعدة «من يطلب ≠ من يعتمد ≠ من ينفّذ».

## 6) التدقيق والحذف المنطقي
`AuditLog` append-only لكل كتابة عبر Interceptor عام. الكيانات المحورية فيها `deletedAt` (حذف منطقي) مع فلترة افتراضية.

## 7) جاهزية تطبيق السائقين
- `VehicleDetail.currentDriverId` و`RentalContract` يكفيان لتطبيق السائق لاحقاً عبر `packages/shared` (REST نظيف + JWT). مؤجَّل عمداً (CLAUDE.md §6).

## 8) طبقة SaaS متعدّدة المستأجرين — **مفعّلة**
- **العزل:** أُضيف `tenantId` على كل الكيانات الجذرية (`User`, `UserRole`, `Role`,
  `RolePermission`, `OrgUnit`, `Asset`, العقود، الصيانة، ...) ويُفرَض عبر وسيط Prisma
  (`TENANT_MODELS`). راجع `02_architecture.md §تعدّد المستأجرين`.
- **الشركة والاشتراك:** `Tenant` (+ هوية `brandName/primaryColor/logoKey` + بيانات حساب
  `legalName/email/contactPhone/city/crNumber/vatNumber` = حقول المشتري للفاتورة) ·
  `TenantSubscription` (سقوف/باقة/محفظة) · `WalletTransaction` (سجل المحفظة).
- **الدفع:** `PaymentIntent` (نية دفع Tap، تُطبَّق مرة واحدة عند تأكيد الشحنة).
- **التخزين:** `StorageObject` (سجل استهلاك لكل شركة) · `TenantStorageConfig` (bucket مخصّص اختياري).
- **المنصّة:** `PlatformAdmin` (مشغّل في جدول مستقل) · `PlatformSetting` (إعدادات منصّة: حساب
  التخزين المشترك + بوابة Tap).
- **الأدوار معزولة:** `Role`/`RolePermission` يحملان `tenantId`؛ `Role` فريد بـ `@@unique([tenantId, name])`.
- **الكتالوج والأنواع:** `AssetClass` (أصناف) · `Model` (ماركة←موديل) · `AssetType.customFields`
  (حقول مخصّصة لكل نوع) · `Asset.color/customValues/meterType/currentMeter`.
- **الصيانة الوقائية:** `MeterReading` (عدّاد/كم) · `MaintenancePlan` (جداول وقائية).

## ملاحظات تنفيذ
- استخدم `prisma migrate` لكل تغيير (نمط diff→deploy عند الحاجة)؛ الأدوار تُزوَّد **لكل شركة**
  عبر `provisionTenantRoles()` (seed/تسجيل ذاتي/إنشاء من المنصّة).
- `maintenanceBearer`/`insuranceBearer` في `ExternalLeaseContract` محسومتان (نقطة #6): تُحدَّدان لكل عقد.
