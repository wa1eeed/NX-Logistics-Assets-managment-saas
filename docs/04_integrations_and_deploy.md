# 04 — التكاملات والنشر

كل التكاملات **مدفوعة بالبيئة (env-driven)** وتعمل بتعطيل لطيف في dev إن لم تُضبط مفاتيحها.
المفاتيح الحسّاسة على مستوى المنصّة (التخزين المشترك + Tap) تُدار من **لوحة مشغّل المنصّة**
(مخزّنة في `PlatformSetting`)، لا من الريبو — والأسرار لا تُعاد للواجهة أبداً.

## 1) التخزين (S3-متوافق: R2 / S3 / GCS / OSS) — **مُحدَّث**
- عميل سحابي **محايد** عبر `endpoint` (نفس الكود يستهدف R2 أو S3 أو GCS أو OSS).
- ثلاث طبقات حلّ لكل طلب: (1) **bucket مخصّص للشركة** (BYO storage، `TenantStorageConfig`)،
  (2) **الحساب المشترك للمنصّة** (يُضبط من لوحة المنصّة، صلاحية `entitlements.manage`)،
  (3) **قرص محلي بديل** في dev (روابط موقّعة محليًا).
- **عزل لكل شركة:** كل الملفات تحت مجلد `tenant_<tenantId>/<module>/...`؛ منع الوصول
  العابر للشركات على مستوى المفتاح. Bucket **خاص** + **Presigned URLs** قصيرة الأمد فقط.
- **احتساب الاستهلاك:** كل كائن يُسجَّل في `StorageObject`؛ الاستهلاك = مجموع الأحجام لكل شركة
  (يفرض سقف `maxStorageBytes`). معالجة: تحويل الصور إلى WebP، حدّ ٢MB للشعار/PDF.
- `integrations/storage` يوفّر: `putObject`, `getSignedUrl`, `deleteObject`, `buildKey` + إدارة
  حساب المنصّة/الشركة. يخزّن `fileKey` فقط في DB.

## 1.b) بوابة الدفع — Tap (`integrations/payments` + موديول `payments`)
- **حساب تاجر واحد للمنصّة** (developers.tap.company) يحصّل من الشركات؛ يُضبط من لوحة المنصّة
  (`PlatformSetting` key `integrations.tap`، صلاحية `payments.manage`؛ السر مُقنّع).
- **Hosted Checkout:** `POST /v2/charges` → تحويل لصفحة Tap → عودة `/billing/return` + **Webhook**
  → **التحقق من الشحنة من Tap** (لا يُوثَق بالـ body) → **تطبيق idempotent**. أغراض: شحن محفظة/مقاعد/إضافات.
- **Sandbox** عند غياب مفتاح حقيقي (تأكيد محاكى، يُرفض تلقائيًا في وجود مفتاح مباشر).
- env: `WEB_PUBLIC_URL` (روابط العودة) + `TAP_SECRET_KEY/TAP_PUBLIC_KEY` (قيم احتياطية؛ الفعلية من الواجهة).

## 2) Cloudflare CDN
- للأصول العامة/الثابتة للواجهة. الملفات الحسّاسة تبقى خاصة عبر R2 presigned (لا تُوضع خلف CDN عام).

## 3) Resend.com (الإشعارات المعاملاتية)
- موديول `notifications` يستخدم Resend SDK. قوالب: قرب انتهاء عقد/استمارة/مستند، اعتماد تعميد، تنبيه قرار بيع/استحواذ.
- مفتاح: `RESEND_API_KEY`، مرسِل: `MAIL_FROM`.

## 4) Sentry (تتبّع الأخطاء)
- api: `@sentry/node` (+ integration مع NestJS). web: `@sentry/react`.
- نقّ البيانات الحسّاسة (`beforeSend`) قبل الإرسال. مفعّل في staging/production فقط افتراضياً.

## 5) Google Maps API (لاحقاً — تطبيق السائقين)
- لا يُبنى الآن. احجز `GOOGLE_MAPS_API_KEY` في `.env.example` فقط، وأبقِ API الـ rentals/handover نظيفاً ليستهلكه `apps/driver`.

## 6) النشر عبر Coolify (VPS) — بيئة staging
- صور Docker لكل من `api` و`web` (انظر `deploy/Dockerfile.*.example`).
- Postgres: يُدار كخدمة في Coolify أو حاوية منفصلة. الـ migrations تُشغّل عند الإقلاع (`prisma migrate deploy`).
- **الأسرار من Coolify secrets**، لا من الريبو. لا تضع `.env` الحقيقي في git.
- تدفّق مقترح: dev على جهازك → دفع للـ git → Coolify يبني وينشر على staging.

> راجع `deploy/coolify.md` لخطوات الربط.
