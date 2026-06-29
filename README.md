# NX-LAM — منصّة إدارة وتشغيل الأصول (SaaS)

منصّة **متعدّدة المستأجرين (Multi-tenant SaaS)** لإدارة وتشغيل الأصول (مركبات ومعدات):
تسجيل الأصول ودورة حياتها، التأجير الداخلي على المشاريع، الصيانة، البيع والاستحواذ،
المؤشرات التنفيذية — مع طبقة SaaS كاملة (اشتراكات، فوترة ذاتية، بوابة دفع Tap، لوحة
مشغّل المنصّة، تسجيل ذاتي، هوية بصرية، وأدوار معزولة لكل شركة).

> بدأ المشروع كـ «حقيبة مواصفات» (Kit) ثم بُني بالكامل. **مرجع ما نُفّذ فعلاً:**
> [`docs/06_implemented_state.md`](docs/06_implemented_state.md). للتشغيل: [`RUN.md`](RUN.md).

## التشغيل السريع
```bash
docker compose up -d        # Postgres (منفذ 5435)
pnpm install
pnpm setup                  # build shared + prisma generate + migrate + seed
pnpm dev                    # api (3001) + web (5173) + watch shared
```
- الواجهة: http://localhost:5173 · الـ API: http://localhost:3001/api
- دخول الشركة الأولى: `admin@nx-lam.local` / `Admin@12345`
- مشغّل المنصّة: `platform@nx-lam.local` / `Platform@12345`
- أو أنشئ شركتك عبر **التسجيل الذاتي**: http://localhost:5173/register

## الستاك
NestJS + Prisma + PostgreSQL · React + Vite + Tailwind + Shadcn UI + Framer Motion (RTL/i18n) ·
pnpm monorepo · تخزين S3-متوافق (R2/S3/GCS/OSS) · بوابة دفع Tap · Resend · Sentry · Coolify.

## أبرز القدرات
- **عزل متعدّد المستأجرين** على مستوى الاستعلام (وسيط Prisma) + مشغّل منصّة في جدول مستقل.
- **اشتراكات/استحقاقات:** سقوف تخزين/مستخدمين + تفعيل موديولات لكل باقة + حُرّاس 403.
- **فوترة ذاتية + بوابة Tap:** محفظة، شراء مقاعد، تفعيل إضافات، دفع بالبطاقة (Hosted Checkout + Webhook).
- **تسجيل ذاتي + هوية بصرية** لكل شركة، و**أدوار/صلاحيات معزولة** لكل شركة.
- **الأساس الوظيفي:** أصول + كتالوج + جاهزية، تأجير، صيانة + وقائية + امتثال، بيع، استحواذ،
  سائقون، مؤشرات لحظية، استلام/تسليم، تدقيق، حوكمة كاملة.
- **كونسول تتبّع GPS حيّ:** خريطة داكنة + شريطا «المهام» و«المركبات» (نشطة/متاحة/غير متصلة) + فلتر مدينة.

## النشر
صور Docker للإنتاج (api + web + Postgres) **جاهزة ومُختبَرة end-to-end** للنشر عبر **Coolify**:
الواجهة (nginx) تُمرّر `/api` داخليًا، والترحيلات تُطبَّق آليًا عند الإقلاع.
الدليل: [`deploy/coolify.md`](deploy/coolify.md) · القالب: [`.env.staging.example`](.env.staging.example).

## الوثائق
- [`CLAUDE.md`](CLAUDE.md) — تعليمات/مبادئ البناء.
- [`docs/01_conception_ar.md`](docs/01_conception_ar.md) — التصوّر الوظيفي (مصدر الحقيقة للمنطق).
- [`docs/02_architecture.md`](docs/02_architecture.md) — المعمارية + تعدّد المستأجرين + الحماية.
- [`docs/03_data_model.md`](docs/03_data_model.md) — نموذج البيانات + طبقة SaaS.
- [`docs/04_integrations_and_deploy.md`](docs/04_integrations_and_deploy.md) — التخزين/Tap/Resend/Sentry/النشر.
- [`docs/05_decision_points.md`](docs/05_decision_points.md) — نقاط الحسم (كلها محسومة) + قرارات SaaS.
- **[`docs/06_implemented_state.md`](docs/06_implemented_state.md) — مرجع الحالة المنفّذة الشامل (As-Built).**
- [`RUN.md`](RUN.md) — تشغيل بيئة التطوير + حسابات الدخول + شرح الميزات.
