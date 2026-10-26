# گزارش خطاناپذیری کانتینرها، پایداری شبکه و منابع سرور VPS

**تاریخ:** 2026-10-25
**دامنه:** استقرار تک‌میزبان ۴GB (`docker-compose.production.yml`، `docker-compose.staging.yml`، Caddyfile، اسکریپت‌های استقرار)

---

## ۱) بررسی «خط قرمز»: عدم استفاده از عملگر پس‌زمینه `&`

تمام مصنوعات استقرار به‌صورت هدفمند اسکن شدند (نه فقط اسکریپت‌ها):

| فایل | نتیجه |
|---|---|
| `docker-compose.yml` / `.staging.yml` / `.production.yml` | ✅ تمیز |
| `Caddyfile` | ✅ تمیز |
| `.harness/deploy.sh` | ✅ تمیز |
| `.harness/pipeline.yaml` | ✅ تمیز — تنها `&` در رشتهٔ `Build & Restart Frontends` (echo) است |
| `update_sop.sh` | ✅ تمیز |
| `deploy-customer-app.ps1` / `deploy-salon-app.ps1` | ✅ تمیز |
| `scripts/validate-infrastructure.sh` | ✅ تمیز — `&`ها فقط در `2>&1` و داخل الگوهای grep هستند |
| `backend/scripts/*.sh` | ✅ تمیز |

**هیچ فرآیند پس‌زمینه‌ای با `&` (یا `nohup`/`setsid`) راه‌اندازی نمی‌شود.** خط قرمز برقرار است.

## ۲) خطاناپذیری کانتینرها (بررسی پیکربندی — اجرای محلی محدود است)

`docker-compose -f … config` روی هر دو فایل **با موفقیت** اعتبارسنجی شد (exit 0). ساختار استقرار:

| سرویس | restart | mem_limit | healthcheck | توضیح |
|---|---|---|---|---|
| postgres | `unless-stopped` | 1024m | ✅ `pg_isready` | دیتابیس داخلی؛ در production هیچ پورت میزبان منتشر نمی‌کند |
| redis | `unless-stopped` | 256m | ✅ `redis-cli ping` | `allkeys-lru`، داخلی |
| backend-migrate | `"no"` | — | — | یک‌بار مصرف؛ `npm run migration:run` در مرحلهٔ builder |
| backend | `unless-stopped` | 256m | ✅ `node net.connect(3000)` | به `postgres` سالم + تکمیل موفق migration وابسته است |
| admin | `unless-stopped` | 256m | ❌ ندارد | expose 3001 |
| customer-web | `unless-stopped` | 128m | ❌ ندارد | nginx استاتیک، expose 80 |
| salon-web | `unless-stopped` | 128m | ❌ ندارد | nginx استاتیک، expose 80 |
| caddy | `unless-stopped` | 128m | ❌ ندارد | تنها انتشار پورت‌های ۸۰/۴۴۳ |

**وضعیت محیط:** Docker CLI نصب است اما **Daemon روی این میزبان ویندوزی در دسترس نیست**
(`failed to connect to the docker API at npipe:…dockerDesktopLinuxEngine`). اجرای `docker stats`/
`docker ps` در این جلسه ممکن نیست — این بررسی‌ها باید روی خود VPS اجرا شوند (فرمان‌ها در بخش ۴).

### 🟡 Suggestion
- کانتینرهای استاتیک frontend و Caddy فاقد healthcheck هستند؛ در صورت از کار افتادن nginx استاتیک،
  Caddy همچنان ترافیک را به آن ارسال می‌کند. اضافه‌کردن `healthcheck: ["CMD", "wget", "-q", "--spider", ":80/"]`
  برای `customer-web`/`salon-web` و `depends_on: condition: service_healthy` متناظر.

## ۳) پروکسی معکوس و بارگذاری منابع فرانت‌اند روی دامنه

پیکربندی `Caddyfile` بازبینی شد (`boya.bcshopir.ir`):
- ✅ مسیرها: `/api/*`، `/docs*`، `/uploads/*` → `backend:3000`؛ `/admin*` → `admin:3001` (با
  تغییر مسیر `/admin` و `/admin/` به `/admin/fa`)؛ `/app/*` و `/salon/*` با `handle_path` به
  nginxهای استاتیک؛ fallback به `/app/`.
- ✅ فشرده‌سازی `zstd gzip` فعال؛ `Permissions-Policy` مبتنی بر موقعیت روی `/app`.
- ✅ **هیچ `&`ی در پیکربندی وجود ندارد** و TLS خودکار به‌صورت پیش‌فرض بر عهدهٔ Caddy است.
- ⚠️ نکتهٔ سازگاری: build وب باید با `--base-href /app/` (و `--base-href /salon/`) انجام شود تا
  `handle_path` (که پیشوند را برمی‌دارد) مسیر دارایی‌ها را درست حل کند.
- 💭 Nit: `/docs*` (Swagger) روی دامنهٔ عمومی پروکسی می‌شود؛ در production به IP داخلی محدود شود.

**⚠️ محدودیت:** **لاگ‌های زندهٔ شبکه و Caddy روی دامنه از این میزبان قابل بررسی نیستند**
(سرور دور در دسترس نیست). بررسی لاگ روی VPS لازم است — فرمان‌ها در بخش ۴.

## ۴) منابع سرور VPS (۴GB) — فرمان‌های اجرایی روی سرور

سقف‌های حافظهٔ پیکربندی‌شده: ۱۰۲۴+۲۵۶+۲۵۶+۱۲۸+۲۵۶+۱۲۸+۱۲۸ = **۲۱۷۶m** (زیر ۴GB با حاشیهٔ OS).

روی VPS اجرا کنید و خروجی را ضمیمه این گزارش کنید:

```bash
# جدول منابع + تایید گزارش‌شدن هر چهار سرویس اصلی
bash scripts/validate-infrastructure.sh > /tmp/infra-$(date +%F).log 2>&1; cat /tmp/infra-*.log

# وضعیت زندهٔ کانتینرها و تعداد راه‌اندازی مجدد
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RestartCount}}'
docker stats --no-stream

# reverse-proxy/domain health
curl -sI https://boya.bcshopir.ir/api/v1/health | head -5
curl -sI https://boya.bcshopir.ir/app/       | head -5
docker logs --tail 100 boya_caddy_production | grep -iE "error|502|503"
docker logs --tail 100 boya_backend_production | grep -E "Query count|High query count"
```

آخرین خط از هر لاگ دقیقاً خروجی پایش کوئری این دور است: `Query count: N (max: 5)`.

---

## خلاصه
- **«خط قرمز» `&`:** ✅ در هیچ source استقراری وجود ندارد.
- **کانتینرها:** پیکربندی معتبر، تمام سرویس‌های بلندمدت با restart-policy و سقف حافظه؛
  healthcheck برای ۳ سرویس اصلی وجود دارد، برای frontendهای استاتیک خیر (🟡).
- **شبکه/دامنه:** پیکربندی Caddy سازنده است؛ **بررسی لاگ زنده و stats روی VPS باقی مانده**
  (این ایستگاه به Daemon Docker و سرور دسترسی ندارد).
