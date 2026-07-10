# النشر على staging (Coolify / Docker)

منصّة NX-LAM تُنشر كخدمتين (api + web) أمام قاعدة Postgres. الواجهة (nginx) تُمرّر `/api`
داخليًا إلى خدمة الـ api، فلا توجد مكالمات cross-origin ولا حاجة لإعداد CORS معقّد.

> **سياق البناء = جذر المستودع.** الصور: `deploy/Dockerfile.api` و`deploy/Dockerfile.web`.
> الترحيلات تُطبَّق تلقائيًا عند إقلاع الـ api (`prisma migrate deploy`). التطبيق يتّصل بقاعدة
> البيانات كـ `postgres` (يتجاوز RLS) — تفعيل RLS مؤجَّل بخطة موثّقة (راجع docs/06 الملحق).

---

## الطريقة (أ): Coolify عبر docker-compose (الأبسط)

1. أنشئ Resource من نوع **Docker Compose** واربطه بمستودع git، وحدّد المسار
   `deploy/docker-compose.staging.yml`.
2. في **Environment Variables / Secrets** الصق محتوى `.env.staging.example` بعد ملء القيم
   (خصوصًا `POSTGRES_PASSWORD` و`JWT_*` و`WEB_PUBLIC_URL`).
3. اربط الدومين/الساب-دومين بخدمة **web** (المنفذ 80 داخليًا)، وفعّل **TLS** من Coolify.
4. Deploy. ترتيب أوّل إقلاع: db → api (يطبّق الترحيلات) → web.
5. **تهيئة المنصّة (bootstrap — مرّة واحدة):** يُنشئ **مشغّل المنصّة** (من `SEED_PLATFORM_*`) + الباقات + الصلاحيات فقط — بلا أي مستأجر:
   `docker compose -f deploy/docker-compose.staging.yml exec api pnpm --filter api run db:seed:ci`
6. **إدخال أول مشترك (اختياري):** الشركات تسجّل ذاتيًا عبر `/register`. أو لتهيئة مشترك أولي ببياناته الحقيقية مرّة واحدة (بيانات دخوله تُمرَّر وقت التشغيل، لا تُخزَّن):
   `docker compose -f deploy/docker-compose.staging.yml exec -e ONBOARD_ADMIN_EMAIL=admin@alrawaf.com -e ONBOARD_ADMIN_PASSWORD=<قوية> api pnpm --filter api run onboard:ci`
   (يُنشئ الرواف كمستأجر نظيف + يستورد الأسطول الحقيقي. `ONBOARD_SLUG`/`ONBOARD_NAME` تُخصّص الشركة.)

## الطريقة (ب): خدمتان منفصلتان في Coolify + Postgres مُدار

1. أضِف خدمة **Postgres** من Coolify واحصل على `DATABASE_URL`.
2. خدمة **api** ← `deploy/Dockerfile.api` (Build context = الجذر). متغيّراتها: `DATABASE_URL`،
   `API_PORT=3001`، `WEB_PUBLIC_URL`، `CORS_ORIGINS=<WEB_PUBLIC_URL>`، `JWT_*`، و(اختياريًا) R2/Resend/Sentry.
   المنفذ الداخلي 3001.
3. خدمة **web** ← `deploy/Dockerfile.web`. اضبط `API_UPSTREAM` على العنوان الداخلي لخدمة الـ api
   (مثلاً `http://api:3001` أو اسم خدمة الـ api في شبكة Coolify). اربط الدومين + TLS بهذه الخدمة.
4. التهيئة الأولى: شغّل `pnpm --filter api run db:seed:ci` (bootstrap: مشغّل المنصّة + الباقات) داخل حاوية الـ api مرّة واحدة. ثم للمشترك الأولي: `ONBOARD_ADMIN_EMAIL=… ONBOARD_ADMIN_PASSWORD=… pnpm --filter api run onboard:ci`.

---

## تجربة محليًا (اختياري، قبل الدفع)

```bash
cp .env.staging.example .env.staging   # املأ POSTGRES_PASSWORD و JWT_* و WEB_PUBLIC_URL
# مرّر --project-directory . حتى يشير سياق البناء (.) إلى جذر المستودع (نفس سلوك Coolify).
# على مضيف مستقل (بلا بروكسي مثل Coolify) أضِف compose.publish.yml لنشر منفذ الويب:
docker compose -f deploy/docker-compose.staging.yml -f deploy/compose.publish.yml \
  --project-directory . --env-file .env.staging up -d --build
# الواجهة على http://localhost:8080  (تُمرّر /api داخليًا)
# للتطوير المحلي: بذر كامل (منصّة + مشترك تجريبي ممتلئ بالعمليات) بأمر واحد:
docker compose -f deploy/docker-compose.staging.yml --project-directory . exec api pnpm --filter api run db:seed:full
```

## الأسرار المطلوبة (Coolify Secrets — لا تُحفظ في git)

| المتغيّر | لازم؟ | ملاحظة |
|---|---|---|
| `DATABASE_URL` | ✅ (طريقة ب) | في طريقة (أ) يُركّب من `POSTGRES_*` |
| `POSTGRES_PASSWORD` | ✅ (طريقة أ) | كلمة قوية |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✅ | `openssl rand -hex 32` لكلٍّ منهما |
| `WEB_PUBLIC_URL` | ✅ | رابط staging العام (CORS + روابط عودة الدفع) |
| `SEED_PLATFORM_*` | موصى | بيانات دخول **مشغّل المنصّة** (الحساب الوحيد المبذور). المشتركون يسجّلون ذاتيًا أو عبر `onboard:ci` |
| `R2_*`, `CDN_PUBLIC_BASE_URL` | اختياري | بدونها يُعطَّل رفع الملفات بلطف |
| `RESEND_API_KEY`, `MAIL_FROM` | اختياري | بدونها يُعطَّل البريد/التنبيهات |
| `TAP_SECRET_KEY` / `TAP_PUBLIC_KEY` | اختياري | تُدار فعليًا من «بوابة الدفع» في لوحة المنصّة؛ فراغها = ساندبوكس |
| `SENTRY_DSN_API`, `SENTRY_ENVIRONMENT` | اختياري | تتبّع الأخطاء |

## ملاحظات تشغيلية

- **الترحيلات** تعمل في كل إقلاع للـ api (آمنة لإعادة التشغيل). لا تُشغّل `migrate dev` على الإنتاج.
- **رفع الملفات** محدود بـ 25MB في nginx (`client_max_body_size`).
- **بيانات قاعدة البيانات** على Volume باسم `fleet_pg_data` (طريقة أ). خذ نسخًا احتياطية دوريًا.
- تدفّق العمل: تطوير على جهازك → `git push` → Coolify يبني وينشر.
