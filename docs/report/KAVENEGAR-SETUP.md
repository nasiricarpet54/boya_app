# راهنمای ساخت قالب Kavenegar و تست واقعی SMS

> مسیر: `docs/report/KAVENEGAR-SETUP.md`
> مرتبط: `BACKLOG.md` (بخش Testing — SMS)، ADR-010 (دعوتنامه)،
> `backend/src/modules/auth/invite-token.service.ts`، `backend/src/app.module.ts`

این سند می‌گوید چطور قالب‌های پیامک دعوت را در پنل کاوه‌نگار بسازیم، کلید را در `.env`
بیندازیم و یک دعوت واقعی را روی یک شماره موبایل واقعی تست کنیم.

---

## ۰. یک نکته مهم پیش از ساخت قالب (تصحیح پیش‌نویس اولیه)

پیش‌نویس اولیه‌ای این قالب را پیشنهاد داده بود:

```
نام: invite
متن: "دعوت به {0}. برای پذیرش کلیک کنید: {1}"
```

**این قالب کار نمی‌کند**، برای دو دلیل که هر دو از کد معلوم است:

1. **فقط یک متغیر ارسال می‌شود.** `sendInviteSms` در
   `backend/src/modules/auth/invite-token.service.ts:215` دقیقاً یک token می‌فرستد:

   ```ts
   const link = baseUrl ? `${baseUrl}?token=${token}` : token;
   const sent = await this.sms.verify({ to: phone, template, tokens: { token: link } });
   ```

   درایور کاوه‌نگار (`@mirad-work/sms-core`، `kavenegar-driver.ts`) این named token را به
   پارامتر اول کوئری نگاشت می‌کند و چیزی به نام `token2`/`token3` نمی‌سازد:

   ```
   GET https://api.kavenegar.com/v1/{API_KEY}/verify/lookup.json
       ?receptor={phone}&template={template}&token={link}
   ```

   پس قالبی که دو متغیر بخواهد، متغیر دوم را خالی می‌گذارد یا کلاً رد می‌شود.

2. **سینتکس placeholder کاوه‌نگار `%token` است، نه `{0}`.** طبق مستندات رسمی
   (`kavenegar.com/rest.html`، متد `verify/addtemplate`)، متن پیامک الگوی اعتبارسنجی
   *باید* شامل `%token` باشد:

   > textMessage ... برای ارسال پیامکی یا fallback پیامکی باید شامل `%token` باشد.

**قالب درست (دقیقاً یک متغیر):**

```
نام:  invite
متن:  دعوت به پلتفرم بویا صادر شد. برای پذیرش روی لینک زیر کلیک کنید:
      %token
```

قانون ساده: **هر قالب دعوت دقیقاً یک `%token` دارد و جای آن را همان لینک
`${INVITE_BASE_URL}?token=<64hex>` می‌گیرد.**

---

## ۱. پیش‌نیازها

- استک staging بالا باشد (`docker compose ps`): `boya_backend_staging` روی پورت
  **۳۰۰۱** سمت میزبان (نه ۳۰۰۰). `GET http://localhost:3001/api/v1/health` باید `200` بدهد.
- یک حساب کاوه‌نگار با خط فعال و اعتبار کافی.
- یک شماره موبایل واقعی برای دریافت SMS (دو شماره برای E2E کامل: یکی مالک، یکی متخصص).

---

## ۲. ساخت قالب‌ها در پنل کاوه‌نگار

۱. وارد `panel.kavenegar.com` شوید.
۲. به **ارسال پیامک ← قالب‌ها** (الگوهای اعتبارسنجی) بروید و **قالب جدید** بسازید.
۳. نام قالب باید **انگلیسی، بدون فاصله و بدون underline** باشد (طبق مستندات کاوه‌نگار)؛
   خط تیره مجاز است. دقیقاً همین نام‌ها را استفاده کنید تا با پیش‌فرض‌های
   `docker-compose.staging.yml` و `.env.example` همخوان باشد:

| نام قالب (در پنل) | env var متناظر | متن پیشنهادی (یک `%token`) |
|---|---|---|
| `invite` | `KAVENEGAR_INVITE_TEMPLATE` | `دعوت به پلتفرم بویا صادر شد. برای پذیرش کلیک کنید: %token` |
| `invite-owner` | `KAVENEGAR_INVITE_OWNER_TEMPLATE` | `شما به‌عنوان مالک سالن دعوت شدید. برای پذیرش کلیک کنید: %token` |
| `invite-specialist` | `KAVENEGAR_INVITE_SPECIALIST_TEMPLATE` | `شما به‌عنوان متخصص دعوت شدید. برای پذیرش کلیک کنید: %token` |

۴. هر سه قالب را برای **تأیید** ثبت کنید (معمولاً ۱ تا ۳ روز کاری).
۵. **حداقل `invite` الزامی است.** اگر ورد دعوت مالک/متخصص یکی است، دوتای دیگر را نسازید
   و متغیرهای override را در `.env` خالی بگذارید — همهٔ نقش‌ها به `invite` برمی‌گردند
   (به `resolveInviteTemplate` در `invite-token.service.ts:206` نگاه کنید).

> **نقش `line_manager`** قالب اختصاصی ندارد و همیشه از همان قالب generic استفاده می‌کند.

---

## ۳. دریافت کلید API

در پنل: **تنظیمات ← کلید API**. کلید را کپی کنید.

این کلید را در **`.env` ریشهٔ پروژه** (نه `backend/.env`) به‌عنوان `KAVENEGAR_API_KEY`
بگذارید — چون `docker-compose.staging.yml` مقادیر را از `.env` ریشه می‌خواند.

---

## ۴. متغیرهای محیطی

اینها متغیرهایی‌اند که مسیر دعوت می‌خواند (همگی در `docker-compose.staging.yml` مقدار
پیش‌فرض دارند، پس فقط در صورت تغییر از پیش‌فرض در `.env` ریشه می‌آیند):

| متغیر | پیش‌فرض compose | معنی |
|---|---|---|
| `KAVENEGAR_API_KEY` | — (اجباری) | کلید کاوه‌نگار |
| `KAVENEGAR_SENDER` | خالی | شمارهٔ خط فرستنده. **خالی مجاز نیست**: درایور ارسال را با `ConfigurationException: ... requires a valid lineNumber` رد می‌کند (دقیقاً خطای تست ۲۰۲۶-۱۰-۰۷). شمارهٔ خط فعال را از پنل کاوه‌نگار بگیرید. |
| `KAVENEGAR_INVITE_TEMPLATE` | `invite` | قالب generic دعوت |
| `KAVENEGAR_INVITE_OWNER_TEMPLATE` | `invite-owner` | override دعوت مالک؛ خالی = fallback به generic |
| `KAVENEGAR_INVITE_SPECIALIST_TEMPLATE` | `invite-specialist` | override دعوت متخصص؛ خالی = fallback به generic |
| `INVITE_BASE_URL` | `https://staging.boya.ir` | پیشوند لینک؛ بدنهٔ SMS `${INVITE_BASE_URL}?token=<64hex>` |
| `INVITE_EXPIRY_DAYS` | `7` | عمر دعوتنامه (روز) |
| `OTP_DEV_MODE` | `false` | `true` = کد OTP در لاگ چاپ می‌شود به‌جای ارسال SMS |

> **اگر `INVITE_BASE_URL` ست نباشد**، بدنهٔ پیام فقط خودِ token (یک hex ۶۴ کاراکتری)
> می‌شود که هیچ چیزی نمی‌تواند بازش کند. روی staging همین دامنه کافی است تا دامنهٔ
> نهایی روشن شود.

---

## ۵. اعمال env: کانتینر را بازسازی کنید، نه restart

مقدارهای `${VAR}` در `docker-compose.staging.yml` **هنگام ساخت کانتینر** از `.env` ریشه
حل می‌شوند. یعنی:

- `docker restart boya_backend_staging` یا `restart: unless-stopped` **env جدید را نمی‌خواند** —
  همان کانتینرِ موجود با همان env قبلی دوباره بالا می‌آید.
- بعد از ویرایش `.env` باید کانتینر **بازسازی** شود:

  ```bash
  docker compose -f docker-compose.staging.yml up -d backend
  ```

  compose تغییر configuration را تشخیص داده و کانتینر را دوباره می‌سازد.

**راستی‌آزمایی بدون قطع سرویس** — می‌توانید ببینید `up -d` چه چیزی اعمال *خواهد* کرد و
آیا کانتینر فعلی نسبت به `.env` فعلی قدیمی است یا نه:

```bash
# مقدارهای نهایی حل‌شده از .env
docker compose -f docker-compose.staging.yml config \
  | grep -E 'KAVENEGAR|INVITE_|OTP_'

# env کانتینر در حال اجرا
docker inspect boya_backend_staging \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E 'KAVENEGAR|INVITE_|OTP_'
```

> **وضعیت فعلی (۲۰۲۶-۱۰-۰۷):** `.env` ریشه اکنون `KAVENEGAR_SENDER=10004346`
> و `INVITE_BASE_URL=http://192.168.16.100` را دارد (تست ۲۰۲۶-۱۰-۰۷ روی
> `http://localhost` و **بدون sender** اجرا شده بود، به همین دلیل `requires a valid
> lineNumber` داد). مقدارها هنوز واقعی نیستند: `10004346` صرفاً نمونه است،
> `KAVENEGAR_API_KEY` هنوز sandbox، و `OTP_DEV_MODE=true` است. کانتینر در حال اجرا
> **هیچ‌کدام از این تغییرها را نمی‌بیند** — برای اعمال، حتماً
> `up -d --force-recreate backend` بزنید.

---

## ۶. تست محلی

دو اسکریپت در `backend/scripts/` هست (هردو gitignore و غیرcommitted — ابزار دستی هستند،
بخشی از اپ یا CI نیستند):

- **`test-invite.sh`** — کل مسیر دعوت را **در SQL** روی دیتابیس dev می‌برد: ردیف را در
  `invite_tokens` می‌سازد، هش SHA-256 را با `create()` مقایسه می‌کند، لینک
  `${INVITE_BASE_URL}?token=…` را چاپ می‌کند و `accept` را شبیه‌سازی می‌کند.
  **کاوه‌نگار صدا زده نمی‌شود.** برای این است که مطمئن شویم دیتابیس/RLS/هش درست است.
  ```bash
  INVITE_BASE_URL=https://staging.boya.ir bash backend/scripts/test-invite.sh
  ```

- **`test-invite-api.sh`** — مسیر واقعی **HTTP** را روی API در حال اجرا (پورت ۳۰۰۱) صدا
  می‌زند: `POST /api/v1/auth/invite` با JWT ادمین/مالک، توکن plaintext یک‌باره را از
  جواب برمی‌دارد و مرحلهٔ اختیاری `invite/accept` را نشان می‌دهد. این اسکریپت **یک SMS
  واقعی می‌فرستد** (اگر قالب و کلید ست باشند).
  ```bash
  ADMIN_JWT='eyJ...' bash backend/scripts/test-invite-api.sh 09120000000 specialist
  ```

---

## ۷. تست E2E با دو شماره واقعی

پیش‌نیاز: قالب‌ها تأیید شده‌اند، `KAVENEGAR_API_KEY` واقعی در `.env` ریشه است، و
`docker compose -f docker-compose.staging.yml up -d backend` زده شده.

۱. با ادمین پنل وارد شوید و یک دعوت `salon_owner` برای شمارهٔ اول صادر کنید
   (`POST /auth/invite`).
۲. SMS را روی گوشی بگیرید. باید متن قالب `invite-owner` باشد و لینک
   `https://staging.boya.ir?token=<64hex>` در آن باشد.
۳. روی لینک بزنید؛ اپ باز می‌شود، شماره را تأیید کنید (OTP از مسیر `invite` می‌آید تا
   کد لاگین عادی قابل صرف کردن نباشد) و ببینید حساب با نقش `salon_owner` ساخته می‌شود.
۴. حالا همان مالک از داخل سالن خودش یک دعوت `specialist` برای شمارهٔ دوم صادر می‌کند
   (tenant اینجا از JWT می‌آید، نه body) و جریان را تکرار می‌کند.
۵. مواردی که باید تأیید کنید:
   - توکن plaintext فقط **یک‌بار** در جواب برمی‌گردد؛ دیتابیس فقط SHA-256 را دارد.
   - استفادهٔ دوم از همان توکن `401` می‌دهد.
   - نقش دقیقاً همان نقشِ دعوت است و کاربر در tenant درست قفل شده است.
   - `specialist` بلافاصله bookable است (`status='approved'`، `is_active=true`).

---

## ۸. عیب‌یابی

| نشانه | علت |
|---|---|
| `KAVENEGAR_INVITE_TEMPLATE is unset for role=...; invite SMS skipped` | قالب در `.env`/compose ست نیست → `resolveInviteTemplate` در `invite-token.service.ts:206` خالی برگردانده و send سایلنت skip می‌شود |
| `Kavenegar invite SMS was not accepted` | کاوه‌نگار درخواست را رد کرده: نام قالب در پنل نیست، قالب هنوز تأیید نشده، اعتبار ندارید، یا متن قالب با `%token` نمی‌خواند |
| SMS می‌آید ولی فقط یک hex بلند است | `INVITE_BASE_URL` ست نیست → بدنه فقط خود token می‌شود |
| تغییری در `.env` اعمال نمی‌شود | کانتینر restart شده نه بازسازی؛ `up -d backend` بزنید (بخش ۵) |
| `invite SMS failed for role=...: ...` | خطای شبکه/زمان‌بندی کاوه‌نگار. خطا *پرتاب نمی‌شود*: دعوت ذخیره شده و توکن در جواب است؛ از لیست دعوت‌ها دوباره بفرستید |

> **رفتار fail-soft عمدی است:** دعوت *قبل از* ارسال SMS در دیتابیس ذخیره می‌شود و
> plaintext یک‌بار به صادرکننده برمی‌گردد، بنابراین قطعی کاوه‌نگار نباید یک دعوتِ
> کارا را پشت یک خطای پیام‌رسانی پنهان کند (همان الگوی `KavenegarAlertService`).

---

## ۹. چک‌لیست نهایی (پیش از تست واقعی)

به‌ترتیب. همه چیز در **`.env` ریشهٔ پروژه** ست شود (`backend/.env` خوانده نمی‌شود).
مقدارها فقط با بازسازی کانتینر اعمال می‌شوند، پس `up -d` در انتها الزامی است.

- [ ] **`KAVENEGAR_API_KEY`** — کلید واقعی، نه `change-me` (بخش ۳).
- [ ] **`KAVENEGAR_SENDER`** — شمارهٔ خط فعالِ حساب. بدون این مقدار ارسال با
      `requires a valid lineNumber` رد می‌شود (بخش ۴).
- [ ] **`KAVENEGAR_INVITE_TEMPLATE`** — قالب `invite` **تأییدشده** با دقیقاً یک متغیر
      `%token`. تنها قالب الزامی است؛ نقش‌های دیگر به آن fallback می‌کنند (بخش ۲).
- [ ] `KAVENEGAR_INVITE_OWNER_TEMPLATE` / `KAVENEGAR_INVITE_SPECIALIST_TEMPLATE` —
      **اختیاری**؛ فقط اگر ورد دعوت هر نقش باید متفاوت باشد، در غیر این صورت خالی
      بگذارید تا `invite` استفاده شود (بخش ۲).
- [ ] **`INVITE_BASE_URL`** — قابل دسترس از گوشی. روی LAN فعلی `http://192.168.16.100`
      کار می‌کند؛ برای تست خارج از LAN به دامنهٔ عمومی یا یک تونل نیاز است (بخش ۴).
- [ ] **`OTP_DEV_MODE=false`** — وقتی `true` است کد OTP در لاگ چاپ می‌شود به‌جای ارسال
      واقعی. توجه: پیامک دعوت این پرچم را **نمی‌بیند** و همیشه ارسال واقعی را امتحان
      می‌کند، ولی چون fail-soft است فقط یک `WARN` می‌اندازد و دعوت سرجایش می‌ماند.
- [ ] **`docker compose -f docker-compose.staging.yml up -d --force-recreate backend`**
      — بدون این مرحله هیچ‌کدام از موارد بالا روی کانتینر اعمال نمی‌شوند (بخش ۵).
- [ ] `GET http://localhost:3001/api/v1/health` باید `200` بدهد (بخش ۱).

بعد از این‌ها: **بخش ۷** — تست E2E با دو شماره واقعی.
