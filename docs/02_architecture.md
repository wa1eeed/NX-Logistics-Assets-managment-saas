# 02 — المعمارية وحماية البيانات

> **مُحدَّث (2026-06-28):** المنصّة أصبحت **SaaS متعدّدة المستأجرين** فعليًا. هذا الملف
> يصف المعمارية الحالية؛ للتفصيل الكامل لما نُفّذ راجع [`06_implemented_state.md`](06_implemented_state.md).

## المونوريبو (pnpm workspaces)

```
fleet-asset-ops/
├── apps/
│   ├── api/            # NestJS (الموديولز والكلاسز)
│   ├── web/            # React + Vite (البوابات، RTL/i18n)
│   └── driver/         # (لاحقاً) React Native — لا يُبنى الآن
├── packages/
│   ├── shared/         # types/DTOs/enums مشتركة بين api و web و driver
│   └── config/         # إعدادات eslint/tsconfig مشتركة
├── prisma/             # schema + migrations
├── docker-compose.yml  # Postgres للـ dev
└── deploy/             # Dockerfiles + Coolify
```

## لماذا NestJS + Prisma + React؟

- **NestJS** يفرض بنية موديولز/كلاسز (Modules, Providers, Controllers, Services, Guards, Interceptors, Pipes) — يطابق متطلب «سهولة التطوير والصيانة بنظام موديولز وكلاسز».
- **Prisma** يعطي مخططاً تصريحياً واحداً + Migrations آمنة + Types مولّدة — مثالي لتطوّر المخطط مع توسّع المشروع.
- **React + Vite** سريع، وملائم لتعدّد البوابات، ويشارك الأنواع مع تطبيق السائقين عبر `packages/shared`.

## بنية موديول نموذجية (مثال: assets)

```
apps/api/src/modules/assets/
├── assets.module.ts
├── assets.controller.ts      # طبقة HTTP فقط
├── assets.service.ts         # منطق الأعمال
├── asset-status.service.ts   # State Machine (الانتقالات المسموحة)
├── assets.repository.ts      # وصول البيانات (Prisma)
├── dto/                      # create/update/query + class-validator
└── entities/                # أنواع المجال
```

## طبقة الصلاحيات (RBAC + Scoping)

ثلاث طبقات تُطبَّق معاً:

1. **Role-Based (Guard):** هل يملك المستخدم الصلاحية على هذا الـ action؟
2. **Scope/Row-Level:** أي صفوف يرى — يُحقَن `org_unit` المسموح في كل استعلام (مدير المشروع يرى مشروعه فقط، الصيانة ترى أوامرها، الأصول ترى الكل). يُنفّذ عبر طبقة Repository موحّدة تطبّق فلتر النطاق تلقائياً.
3. **Field-Level (Serialization):** الحقول الحسّاسة تُحذف من الـ response حسب الدور عبر DTO/Interceptor.

> اختيارياً يمكن تفعيل **PostgreSQL RLS** كطبقة دفاع ثانية، لكن الاعتماد الأساسي على scoping في طبقة الاستعلام لضمان وضوح المنطق وقابلية الاختبار.

> **الأدوار معزولة لكل شركة:** `Role`/`RolePermission` يحملان `tenantId`، فكل شركة تشكّل
> أدوارها وصلاحياتها الخاصة بمعزل تام (كتالوج الصلاحيات `Permission` يبقى عامًا = قدرات الكود).

## تعدّد المستأجرين (Multi-Tenancy) — **مفعَّل**

النمط: **قاعدة بيانات مشتركة + `tenantId` على كل كيان جذري + عزل على مستوى الاستعلام**.
- سياق المستأجر عبر `AsyncLocalStorage` يُضبط من `req.user.tenantId` بواسطة `TenantContextInterceptor`.
- **وسيط Prisma** (`$use`) يحقن/يفلتر `tenantId` تلقائيًا على كل عملية لكل موديل في `TENANT_MODELS`
  (عزل محكم لا يعتمد على ذاكرة المطوّر). غياب السياق ⇒ لا عزل (seed/مسارات عامة/مشغّل المنصّة).
- **مشغّل المنصّة (Control-Plane)** في جدول `PlatformAdmin` مستقل (ليس مستخدم شركة)؛ مصادقة
  ثنائية الهوية عبر مطالبة `kind` في الـ JWT؛ `tenantId=null` ⇒ يرى كل الشركات مع تمرير فلتر صريح.

## موديولات الـ API

النطاق: `auth · rbac · users · org-units · assets · asset-types · catalog · rentals · handover ·
maintenance · preventive · disposal · acquisition · drivers · kpis · dashboard · lookups · settings ·
audit · notifications`. طبقة SaaS: `entitlements · billing · payments · platform · tenant`.
تكاملات: `integrations/storage` (S3-متوافق) و`integrations/payments` (Tap).

## قابلية التوسّع للإدارات والأقسام

`OrgUnit` هرمي (`DIVISION` → `DEPARTMENT` → `PROJECT`) مع `parentId`؛ العقد/العهدة يرتبطان بـ
`orgUnitId`، فإضافة إدارة/قسم = صف في `org_units` بلا تعديل كود. وكل شركة تنشئ أدوارها وهيكلها بنفسها.

## حماية البيانات (تفصيل)

- Auth: JWT access قصير + refresh، تدوير الـ refresh، Argon2 للكلمات.
- نقل: TLS فقط. رؤوس أمان عبر Helmet. CORS مقيّد. Rate limiting.
- تحقّق المدخلات: class-validator DTOs على كل Endpoint.
- الملفات: R2 bucket خاص، Presigned URLs قصيرة الأمد، لا روابط مباشرة دائمة.
- التدقيق: AuditLog append-only عبر Interceptor عام.
- الحذف: منطقي (`deletedAt`) للكيانات المحورية، مع فلترة افتراضية.
- المراقبة: Sentry لالتقاط الأخطاء (api + web) مع تنقية البيانات الحسّاسة قبل الإرسال.
