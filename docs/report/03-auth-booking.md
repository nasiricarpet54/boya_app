# ۰۳ — احراز هویت، امنیت و چرخه حیات رزرو

> اولویت: **بالا**
> فایل‌های کلیدی: `backend\src\modules\auth\*`, `backend\src\modules\booking\*`, `backend\src\database\tenant-context.ts`

---

## ۳.۱ احراز هویت با OTP

### ۳.۱.۱ جریان کلی

```
POST /auth/otp/send   → OtpService.sendOtp()   → تولید کد ۶ رقمی + ذخیره hash در Redis + ارسال SMS (Kavenegar)
POST /auth/otp/verify → OtpService.verifyOtp() → then AuthService.verifyOtpAndIssueToken()
```

### ۳.۱.۲ `OtpService` — پارامترهای امنیتی

از `backend\src\modules\auth\otp.service.ts`:

```ts
const OTP_TTL_SECONDS = 120;          // عمر کد: ۲ دقیقه
const RATE_WINDOW_SECONDS = 600;      // پنجره rate limit: ۱۰ دقیقه
const MAX_SENDS_PER_WINDOW = 3;       // حداکثر ۳ ارسال در پنجره
const MAX_VERIFY_ATTEMPTS = 5;        // حداکثر ۵ تلاش تأیید
```

نقاط قوت:

- **کد تصادفی امن:** `randomInt(100000, 1000000)` از ماژول `crypto` — نه `Math.random`.
- **ذخیره hash شده:** کد ذخیره‌شده هرگز خام نیست:

```ts
private hash(phone: string, code: string): string {
  return createHash('sha256')
    .update(`${this.config.getOrThrow<string>('OTP_PEPPER')}:${phone}:${code}`)
    .digest('hex');
}
```

  حضور `OTP_PEPPER` (که در `env.validation.ts` **الزامی** است) به‌همراه `phone` یعنی حتی با دسترسی به Redis، حمله rainbow-table بی‌فایده است.
- **مقایسه زمان‌ثابت:** `timingSafeEqual` برای جلوگیری از timing attack.

```ts
private sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- **Rate limit دوطرفه:** هم روی ارسال (`otp:rate:<phone>`) و هم روی تلاش تأیید (`otp:tries:<phone>`).
- **باطل‌سازی پس از موفقیت:** `del(otpKey, attemptKey)` — کد یک‌بارمصرف واقعی است.
- **حذف کد در صورت شکست SMS:** اگر Kavenegar خطا بدهد، کد از Redis حذف می‌شود (نو کاربر با کدی که نرسیده گیر نمی‌افتد).
- **حالت توسعه امن:** فلگ صریح `OTP_DEV_MODE === 'true'` (نه `NODE_ENV`)، با توضیح صریح در کد: «پیش‌فرض production خاموش است، پس نبود متغیر هرگز ارسال واقعی را بی‌صدا غیرفعال نمی‌کند.»

نقاط ضعف/ریسک:

- **`MAX_SENDS_PER_WINDOW` جهانی است، نه کشی.** rate limit به شماره تلفن بسته است و هیچ محدودیت IP یا دستگاه وجود ندارد — یک مهاجم می‌تواند با انبوهی از شماره‌ها هزینه SMS ایجاد کند (SMS bombing / toll fraud). برای فاز دوم، rate limit در سطح IP و/یا هندپذیر در CDN توصیه می‌شود.
- `normalizePersianPhone` ارقام فارسی/عربی را به لاتین تبدیل کرده و الگوی `^09[0-9]{9}$` را الزامی می‌کند. سخت‌گیرانه و درست است، اما اگر روزی شماره بین‌المللی لازم شود باید بازبینی شود.

### ۳.۱.۳ `AuthService` — صدور توکن

از `backend\src\modules\auth\auth.service.ts`:

```ts
const rows = await this.dataSource.query(
  `SELECT id, phone, full_name, role, is_new, tenant_id FROM find_or_create_customer_by_phone($1)`,
  [normalized],
);
const tenantId = row.tenant_id ?? null;
const token = await this.jwtService.signAsync({
  sub: row.id,
  phone: row.phone,
  role: row.role,
  tenantId,
});
```

نکات کلیدی:

- **`tenantId` از دیتابیس می‌آید، نه از درخواست.** این مهم‌ترین تصمیم امنیتی این ماژول است: چون `users` تحت `FORCE ROW LEVEL SECURITY` است و درخواست ورود هیچ context نداری، خواندن `tenant_id` فقط از طریق تابع `SECURITY DEFINER` ممکن است. این تابع پس از مصرف OTP معتبر همان شماره صدا زده می‌شود، پس «تماس‌گیرنده فقط می‌تواند tenant شماره‌ای را بیاموزد که خودش کنترل می‌کند».
- **مشتری `tenantId = null` دارد** (ستون در مهاجرت ۷ nullable شد). سالن‌دار/مدیر خط/متخصص/ادمین `tenantId` دارند.
- `role` داخل توکن امضا می‌شود و در بررسی‌های مجوزدهی (`APPROVER_ROLES`) خوانده می‌شود.

### ۳.۱.۴ یافته‌های امنیتی احراز هویت

| # | یافته | شدت |
| --- | --- | --- |
| A1 | `MAX_SENDS_PER_WINDOW` فقط روی شماره است، بدون IP → SMS bombing | متوسط |
| A2 | نقشه لوکال `normalizePhone` در `AuthService` **از نو نوشته شده** (کامنت: «`normalizePersianPhone` خصوصی است؛ اینجا نسخه حداقلی بازتولید شده») → دو پیاده‌سازی موازی که می‌توانند از هم واگرا شوند و مسیرهایی با شماره نرمال‌نشده بسازند | **بالا** |
| A3 | `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` الزامی‌اند اما هیچ endpoint refresh token در فهرست فایل‌های auth دیده نمی‌شود | بررسی |
| A4 | بازنشانی/باطل‌سازی توکن (revocation/blacklist) وجود ندارد → توکن دزدیده‌شده تا انقضا معتبر است | متوسط |
| A5 | `otp.service.spec.ts` تنها فایل spec در auth است | — |

---

## ۳.۲ چرخه حیات رزرو و ماشین وضعیت

### ۳.۲.۱ وضعیت‌ها (`BookingStatus`)

از `backend\src\modules\booking\booking.entity.ts`:

```ts
Pending   = 'pending',
Confirmed = 'confirmed',
Cancelled = 'cancelled',
Completed = 'completed',
NoShow    = 'no_show',
Reviewed  = 'reviewed',   // terminal — پس از بازخورد اجباری مشتری
```

نقش‌های مجاز برای اقدام سمت سالن (`APPROVER_ROLES`):

```ts
['salon_owner', 'line_manager', 'specialist']
```

### ۳.۲.۲ حالت‌گذارهای تعریف‌شده (`booking.service.ts`)

| متد | گذار | گیت | سمت |
| --- | --- | --- | --- |
| `create` | — → `pending` | ساعات کاری + فعال بودن خدمت/متخصص + آینده بودن زمان + Exclusion | مشتری |
| `approve` | `pending` → `confirmed` | فقط اگر `pending` باشد؛ نقش باید در `APPROVER_ROLES` باشد و `tenantId` داشته باشد | سالن |
| `reject` | `pending` → `cancelled` | فقط اگر `pending` باشد (نه confirmed/completed) | سالن |
| `cancel` | → `cancelled` | نه اگر قبلاً `cancelled` یا `completed`؛ محاسبه بازپرداخت | مشتری/سیستم |
| `markVisited` | `confirmed` → `completed` | فقط `confirmed` | سالن |
| `markReviewed` | `completed` → `reviewed` | فقط `completed`؛ فراخوانی از `ReviewService` | سیستم |
| `confirmVisitByCustomer` | (ستون `visit_confirmed_by_customer_at`) | رزرو باید متعلق به فراخوان باشد | مشتری |
| no-show (cron) | `confirmed` → `no_show` | `lower(time_slot)+30min < NOW` و `visit_confirmed IS NULL` | سیستم |

**نکته مهم:** هیچ متد `book` برای مستقیماً ساختن رزرو به‌عنوان سالن وجود ندارد — همه‌چیز از مشتری شروع می‌شود و تأیید سالن، تنها گیت است. «در فاز اول هیچ پرداختی نیست؛ تأیید، تنها گیت است» (کامنت صریح در `approve`).

### ۳.۲.۳ جریان `create` — الگوریتم اسلات و صحت همروندی

از `backend\src\modules\booking\booking.service.ts` (۸۱–۱۲۰):

```
1. catalog.findById (خدمت) + specialists.findById (متخصص)
2. اگر !isActive هرکدام → BadRequest
3. اگر startsAt <= now → BadRequest
4. assertWithinWorkingHours(tenantId, startsAt, duration)  ← احترام به ساعت کاری سالن
5. end = startsAt + duration*60_000
6. dataSource.transaction(async manager => {
     await setTenantContext(manager, tenantId);     // GUCtransaction-local
     manager.save(Booking{ timeSlot: "[start,end)" , status: pending, totalPrice })
   })
7. error handler: 23P01 (exclusion) و 40P01 (deadlock GIST) → ConflictException
```

نکات کلیدی:

- **`assertWithinWorkingHours`** از `utils\working-hours.util.ts` (`isOpenFor`) استفاده می‌کند و فقط وقتی اعمال می‌شود که `tenants.working_hours` پر شده باشد؛ tenantهایی که هنوز `{}` دارند (هرگز تنظیم نشده) رفتار قدیمی را حفظ می‌کنند که «تنها گیت، تأیید سالن است».
- **`set_config(..., true)` تراکنش-محلی است**، بنابراین مقدار GUC هرگز از اتصال pool «نشتی» نمی‌کند و درخواست بعدی همان اتصال، یک tenant قبلی را نمی‌بیند. این، پاسخ به نگرانی «پذیرش cross-tenant» است — طراحی درست است.
- ترجمه خطا **هر دو** کد `23P01` و `40P01` را map می‌کند:

```ts
if (isOverlap(error) || (error.code && error.code === '40P01')) {
  throw new ConflictException('این بازه زمانی قبلاً برای این متخصص رزرو شده است...');
}
```

  انکودینگ پیام فارسی هنگام خواندن با PowerShell آسیب دیده ولی در فایل UTF-8 است؛ محتوای واقعی در فرانت فارسی نمایش داده می‌شود.

### ۳.۲.۴ الگوریتم تولید اسلات (`availability.service.ts`)

```ts
const DAY_KEY: Record<number, keyof WorkingHours> = { 6:'sat', 0:'sun', 1:'mon', 2:'tue', 3:'wed', 4:'thu', 5:'fri' };

// Friday بسته است مگر صریحاً active باشد
generateSlots({ workingHours, date, durationMinutes, stepMinutes = 30 })
  → روز = workingHours[DAY_KEY[date.getDay()]]
  → اگر !day?.active → []
  → از open تا close با گام ۳۰ دقیقه، هر اسلات به طول duration

filterAvailable(candidates, busy) →
  candidates.filter(slot => busy.every(item => slot.end <= item.start || slot.start >= item.end))
```

مشاهدات:

- گام اسلات ثابت ۳۰ دقیقه است؛ خدماتی با مدت کمتر از ۳۰ دقیقه همچنان یک اسلات ۳۰ دقیقه‌ای اشغال می‌کنند (بخش ۰۵ از مشاور می‌پرسد آیا این بیکاری اسلات برای بازار ایران قابل قبول است).
- `isFriday` وجود دارد ولی در `create` مستقیماً صدا زده نمی‌شود؛ جمعه صرفاً با نبود `fri.active` در `working_hours` بسته می‌شود. اگر `working_hours` خالی باشد (`{}`)، `assertWithinWorkingHours` اصلاً بررسی نمی‌کند و جمعه باز می‌ماند — رفتار عمدی ثبت‌شده.

---

## ۳.۳ محاسبه بازپرداخت / جریمه (`cancellation-policy.service.ts`)

```ts
calculate({ totalPrice, startsAt, now, reason }):
  specialist_unavailable  → 100% بازپرداخت ('به دلیل مشکل از سمت ارائهدهنده')
  no_show                 → 0% ('بدون بازپرداخت')
  customer_request:
    hours >= 24  → 100%   ('بیش از ۲۴ ساعت قبل')
    hours >= 2   → 50%    ('بین ۲ تا ۲۴ ساعت قبل')
    else         → 0%     ('کمتر از ۲ ساعت قبل')
```

- `Math.round((total * percentage)/100)` — مقادیر integer ریال.
- **متوکل pure و بدون حرکت پول است:** کامنت صریح «Refund math only. It does not move money.» تماس با درگاه در `PaymentService.markRefundPending` انجام می‌شود (بخش ۰۴).
- جریمه مخالف بازپرداخت است: `penaltyAmount = total - refundAmount`.

> پیشنهاد برای مشاور: فعلاً `no_show` جریمه ۱۰۰٪ دارد. آیا سیاست کسب‌وکار ایران که می‌خواهد مشتری برای «عدم حضور پس از رزرو تأییدشده» جریمه شود، باید اجراشدنی باشد؟ کاربردی کردن جریمه در فاز ۱ غیرممکن است چون پرداخت آنلاین خاموش است (بخش ۰۴).

---

## ۳.۴ مدل مجوزدهی سمت سالن

از `booking.service.ts`:

```ts
private requireApprover(user: AuthenticatedUser): string {
  if (!user || !(APPROVER_ROLES as readonly string[]).includes(user.role)) {
    throw new ForbiddenException('این عملیات فقط برای سالن یا مدیر خط مجاز است');
  }
  if (!user.tenantId) {
    throw new ForbiddenException('حساب شما به سالنی متصل نیست');
  }
  return user.tenantId;
}
```

نقاط قوت:

- `tenantId` و `role` **هر دو از توکن تأییدشده** می‌آیند، نه از بدنه درخواست → غیرقابل جعل. کامنت صریح: «هر دو حقیقت از توکن تأییدشده می‌آیند، پس هیچ‌کدام قابل جعل نیستند.»
- `findScoped(bookings, tenantId, id)` هم `id` و هم `tenantId` را در `where` می‌گذارد، و در همان تراکنش tenant-scoped اجرا می‌شود → یک سالن هرگز نمی‌تواند رزرو سالن دیگر را حتی با حدس زدن UUID ببیند یا تغییر دهد (دفاع لایه‌ای: شرط where + RLS).

نقاط ضعف:

- **`APPROVER_ROLES` همه سه نقش را یکسان می‌بیند.** یک «متخصص» می‌تواند رزروهای هر متخصص دیگر همان سالن را تأیید/رد/تکمیل کند، نه فقط رزروهای خودش. این ممکن است برای یک سالن کوچک قابل قبول باشد، ولی برای سالن بزرگ یک مشکل «تفکیک وظایف» است. **پرسش مشاور.**
- `confirmVisitByCustomer` از `this.bookings.findOne({ where: { id, customerId } })` استفاده می‌کند — چون `bookings` تحت `FORCE ROW LEVEL SECURITY` است و مشتری `tenantId = null` دارد، این خواندن ممکن است `null` برگرداند (همان مشکل «ساکت صفر ردیف») مگر `app.current_tenant_id` تنظیم شده باشد. **یک باگ محتمل — بخش ۰۵.**
- `markReviewed(tenantId, id)` و `findById(tenantId, id)` هیچ `setTenantContext` ندارند و صرفاً به `this.bookings.findOne({ where: { tenantId, id } })` تکیه می‌کنند. اگر RLS با GUC تنظیم‌نشده فعال باشد، این خواندن‌ها صفر ردیف برمی‌گردانند. **یک باگ محتمل — بخش ۰۵.**
- `cancel(tenantId, id, reason)` به‌طور مشابه `findById` را بدون tenant context صدا می‌زند.

---

## ۳.۵ گردش‌کار No-Show

از `backend\src\modules\notification\services\reminder.scheduler.ts`:

```ts
const NO_SHOW_GRACE_MINUTES = 30;
const CRON_TIMEZONE = 'Asia/Tehran';

@Cron('*/15 * * * *', { timeZone: CRON_TIMEZONE })
async detectNoShows() { await this.run('no-show sweep', () => this.markNoShows()); }

private async markNoShows() {
  const rows = await this.dataSource.query(
    `UPDATE bookings SET status = $1
      WHERE status = $2 AND visit_confirmed_by_customer_at IS NULL
        AND lower(time_slot) + ($3 || ' minutes')::interval < NOW()
      RETURNING id, customer_id`,
    [BookingStatus.NoShow, BookingStatus.Confirmed, NO_SHOW_GRACE_MINUTES],
  );
  for (const row of rows) {
    await this.dataSource.query(`UPDATE users SET no_show_count = no_show_count + 1 WHERE id = $1`, [row.customer_id]);
  }
  return rows.length;
}
```

مشاهدات:

- grace برابر **۳۰ دقیقه** پس از `lower(time_slot)`.
- مشتری با `confirmVisitByCustomer` مقدار `visit_confirmed_by_customer_at` را تنظیم می‌کند و sweep دیگر متوقف می‌شود — این **دقیقاً دلیل وجود فعل و انفعال `FORCE RLS` است**. اگر `confirmVisitByCustomer` به‌خاطر نگنجیدن GUC شکست بخورد، مشتری هیچ راهی برای نجات از `no_show` ندارد.
- اگر سالن زودتر `markVisited` بزند (`confirmed → completed`)، وضعیت دیگر `confirmed` نیست و sweep هرگز آن را نمی‌گیرد.
- **معماری sweep در سطح اپلیکیشن است، بدون قفل دیتابیس.** دو نسخه از اپ که هم‌زمان cron اجرا کنند می‌توانند هر دو `UPDATE ... RETURNING` را انجام دهند — اما چون `UPDATE` اتمی است و `status = 'confirmed'` در `WHERE` قید شده، تنها یکی ردیف را برمی‌گرداند. پس شمارش `no_show_count` هم دوباره‌شماری نمی‌شود. **این طراحی درست است** (به سبک claim-then-act).
- `sendBookingReminders` (هر ۳۰ دقیقه) و `sendFeedbackReminders` (هر ۳۰ دقیقه): در یک `UPDATE ... RETURNING` ردیف را «claim» می‌کنند و ستون `*_reminder_sent_at` را ست می‌کنند، سپس اعلان می‌فرستند. شکست در ارسال SMS/push زمان‌بند را عقب نمی‌اندازد — عمداً، چون «قطع سرویس اطلاع‌رسانی نباید کار را بی‌نهایت retry کند».

**باگ احتمالی:** در `notify()` تلفن مشتری با JOIN `users → tenants` خوانده می‌شود:

```sql
SELECT u.phone FROM users u JOIN tenants t ON t.id = u.tenant_id WHERE u.id = $1
```

اما `users.tenant_id` برای مشتری **NULL** است (مهاجرت ۷ آن را nullable کرد). این JOIN **هیچ ردیفی** برنمی‌گرداند → SMS یادآوری برای مشتریان هرگز ارسال نمی‌شود (درحالی‌که push و اعلان درون‌برنامه‌ای کار می‌کنند). این یک **باگ تأییدشده** است — بخش ۰۵.

---

## ۳.۶ ریسک‌ها و شکاف‌های بخش احراز هویت/رزرو

| # | ریسک | شدت | توضیح |
| --- | --- | --- | --- |
| B1 | پیاده‌سازی دوگانه نرمال‌سازی شماره | **بالا** | `AuthService.normalizePhone` بازنویسی موازی `OtpService.normalizePersianPhone` است |
| B2 | `confirmVisitByCustomer` بدون tenant GUC | **بالا** | احتمال شکست در خواندن رزرو مشتری (RLS) |
| B3 | `findById`/`cancel`/`markReviewed` بدون `setTenantContext` | **بالا** | احتمال صفر ردیف تحت RLS |
| B4 | JOIN `users→tenants` در `notify()` | **بالا** | SMS یادآوری هرگز ارسال نمی‌شود |
| B5 | نقش متخصص در `APPROVER_ROLES` = دسترسی به رزروهای دیگر متخصصان | متوسط | سؤال مشاور |
| B6 | بدون refresh/revoke توکن | متوسط | `JWT_REFRESH_SECRET` الزامی ولی مصرف‌نشده |
| B7 | بدون rate limit در سطح IP | متوسط | ریسک SMS bombing |
| B8 | گام اسلات ثابت ۳۰ دقیقه | کم | هدر رفتن ظرفیت برای خدمات کوتاه |
| B9 | `time_slot` با فاصله `commit` بدون advisory lock | کم | طراحی درست است؛ Exclusion محافظ نهایی |
| B10 | بدون تست integration برای رزرو/همپوشانی | **بالا** | بخش ۰۵ |


