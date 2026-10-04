# ۰۴ — پرداخت، بازپرداخت و سیاست کنسلی

> اولویت: **بالا** — این بخش بزرگ‌ترین شبهه بین «مستندات» و «کد» است.
> فایل‌های کلیدی: `backend\src\modules\payment\*`, `backend\src\modules\booking\cancellation-policy.service.ts`

---

## ۴.۱ خلاصه اجرایی: پرداخت آنلاین وجود ندارد

> **مهم‌ترین جمله این گزارش:** در فاز اول، **هیچ پرداخت آنلاینی فعال نیست**. این یک انتخاب آگاهانه است، نه یک باگ. منبع: `PROJECT_CHARTER.md` («پلتفرم پرداخت آنلاین پردازش نمی‌کند، کمیسیون نمی‌گیرد، escrow ندارد، بازپرداخت ندارد، درآمد تقسیم نمی‌کند»).

وضعیت واقعی کد:

| مورد | وضعیت واقعی |
| --- | --- |
| درگاه پرداخت | **Zarinpal** (`ZarinpalPaymentProvider`) |
| Stripe | ❌ **استفاده نمی‌شود** — فقط در `package.json` (`stripe@22.6.2`) و `README.md` و `env.validation.ts` |
| Stripe Connect / Split Payments | ❌ **وجود ندارد** — هیچ کامیت‌شده‌ای از `stripe` در `backend\src` نیست |
| `PAYMENTS_ENABLED` | **پیش‌فرض `false`** (در `payment.service.ts`: `this.config.get<boolean>('PAYMENTS_ENABLED', false) === true`) |
| رفتار در حالت خاموش | `assertEnabled()` یک `ServiceUnavailableException('در فاز اول، پرداخت آنلاین فعال نیست')` پرتاب می‌کند |
| بازپرداخت واقعی | ❌ **وجود ندارد** — `markRefundPending` وضعیت را `refunded` می‌کند بدون حرکت واقعی پول |
| Payout به متخصص | ❌ **وجود ندارد** — کامنت مهاجرت: «specialist payout is not automated» |
| escrow | ❌ **وجود ندارد** |

---

## ۴.۲ جریان پرداخت (برای فاز دوم — کد کامل ولی خاموش)

### ۴.۲.۱ `PaymentService.initiate(tenantId, bookingId)`

از `backend\src\modules\payment\payment.service.ts`:

```ts
const FIRST_BOOKING_FEE = 0.2;

async initiate(tenantId: string, bookingId: string): Promise<Transaction> {
  this.assertEnabled();                                        // ← در فاز ۱ اینجا قطع می‌شود
  const booking = await this.bookings.findById(tenantId, bookingId);
  if (booking.status !== BookingStatus.Pending) throw new BadRequestException('این رزرو در وضعیت قابل پرداخت نیست');

  const existing = await this.transactions.findOne({ where: { tenantId, bookingId } });
  if (existing && existing.status !== 'failed') throw new ConflictException('برای این رزرو قبلاً تراکنش ایجاد شده است');

  const total = Number(booking.totalPrice);
  const first = await this.isFirstCapturedBooking(tenantId, booking.customerId);
  const platformFee = first ? Math.round(total * FIRST_BOOKING_FEE) : 0;
  const specialist = await this.specialists.findById(tenantId, booking.specialistId);
  const specialistShare = Math.round((total * Number(specialist.commissionRate)) / 100);

  const intent = await this.provider.createPaymentIntent({ amount: total, bookingId, tenantId, description: `رزرو ${bookingId}` });

  return this.transactions.save(this.transactions.create({
    tenantId, bookingId,
    provider: this.provider.name,
    providerIntentId: intent.providerIntentId,
    status: 'pending',
    totalAmount: String(total),
    platformFee: String(platformFee),
    specialistShare: String(specialistShare),
    salonShare: String(/* total - specialistShare */),
    metadata: { redirectUrl: intent.redirectUrl, isFirstBooking: first },
  }));
}
```

مدل درآمدی (در صورت فعال شدن):

- **کمیسیون پلتفرم:** ۲۰٪ **فقط برای نخستین رزرو پرداخت‌شده هر مشتری در هر سالن** (`isFirstCapturedBooking`).
- **سهم متخصص:** `round(total * commissionRate / 100)` — نرخ پیش‌فرض `50`.
- **سهم سالن:** `total - specialistShare`.
- `salonShare` **کمیسیون پلتفرم را کم نمی‌کند** — این یک نکته حسابداری است که مشاور باید تأیید کند (آیا `platformFee` از سهم سالن کسر می‌شود یا از کل؟).

مقادیر در `transactions` به‌صورت `DECIMAL(12,0)` ذخیره می‌شوند — **ریال صحیح، بدون اعشار**. `Math.round` در محاسبات تضمین می‌کند هیچ رقم کسری وارد ستون نشود.

### ۴.۲.۲ بازگشت از Zarinpal — `completeZarinpalReturn`

```ts
async completeZarinpalReturn(authority: string, status: string): Promise<Transaction | null> {
  this.assertEnabled();
  if (status !== 'OK' || !authority) return null;

  const eventId = `zarinpal:${authority}`;
  if (await this.processed.findOne({ where: { eventId } })) return this.findByAuthority(authority);

  const transaction = await this.findByAuthority(authority);
  if (!transaction || transaction.status === 'captured') return transaction;   // ← idempotency دوباره

  const verified = await this.provider.verifyPayment(authority, Number(transaction.totalAmount));
  if (!verified.success) {
    transaction.status = 'failed';
    return this.transactions.save(transaction);
  }

  return this.dataSource.transaction(async (manager) => {
    transaction.status = 'captured';
    transaction.capturedAt = new Date();
    transaction.metadata = { ...transaction.metadata, refId: verified.refId };
    const saved = await manager.save(transaction);
    await manager.save(ProcessedWebhookEvent, { eventId, eventType: 'zarinpal.verified' });
    const booking = await this.bookings.findById(saved.tenantId, saved.bookingId);
    this.emitter.emit(PAYMENT_CAPTURED, { bookingId, tenantId, customerId, specialistId, amount, isFirstBooking });
    return saved;
  });
}
```

**لایه‌های idempotency (نقاط قوت واقعی این طراحی):**

1. `processed_webhook_events.event_id` به‌عنوان **PRIMARY KEY** → دو callback هم‌زمان یک رکورد نمی‌سازند.
2. بررسی `processed.findOne({ eventId })` قبل از هر کار → اگر قبلاً پردازش شده، همان تراکنش برگردانده می‌شود.
3. بررسی `transaction.status === 'captured'` → حتی اگر `processed` جا افتاده باشد، تراکنش دوباره verify نمی‌شود.
4. **قید UNIQUE روی `transactions.booking_id`** (مهاجرت ۴) → هر رزرو حداکثر یک تراکنش.
5. `verifyPayment` کد `100`/`101` Zarinpal را به success map می‌کند (verify تکراری).

این طراحی برای یک درگاه real-world **خوب و دقیق** است. مشکل اصلی این است که هرگز با یک تراکنش واقعی زارین‌پال در CI تست نشده (بخش ۰۵).

### ۴.۲.۳ مسیر HTTP

- **Webhook جداگانه وجود ندارد.** تنها مسیر، یک GET است: `GET /payments/zarinpal/callback?Authority=...&Status=...`.
- هیچ مسیری برای `initiate` از سمت پنل مشتری در فهرست فرانت‌ها دیده نمی‌شود (بخش ۰۵).

---

## ۴.۳ بازپرداخت — تعریف دقیق و شکاف بزرگ

```ts
async markRefundPending(tenantId, bookingId, reason: CancellationReason): Promise<Transaction> {
  this.assertEnabled();
  const transaction = await this.transactions.findOne({ where: { tenantId, bookingId } });
  if (!transaction) throw new NotFoundException('تراکنش این رزرو یافت نشد');
  if (transaction.status === 'refunded') throw new ConflictException('این تراکنش قبلاً بازپرداخت شده است');

  const cancelled = await this.bookings.cancel(tenantId, bookingId, reason);
  if (cancelled.refund.refundAmount <= 0) throw new BadRequestException('طبق سیاست کنسلی، بازپرداختی تعلق نمی‌گیرد');

  const refund = await this.provider.refund({ providerIntentId: transaction.providerIntentId, amount: cancelled.refund.refundAmount });

  transaction.status = 'refunded';
  transaction.refundAmount = String(cancelled.refund.refundAmount);
  transaction.providerRefundId = refund.providerRefundId;
  transaction.refundedAt = new Date();
  const saved = await this.transactions.save(transaction);
  this.emitter.emit(REFUND_MARKED, { bookingId, tenantId, customerId, amount });
  return saved;
}
```

**شکاف‌های اساسی این متد:**

1. **نام متد `markRefundPending` است ولی وضعیت را به `refunded` می‌برد** — یعنی «در انتظار» و «انجام‌شده» در یک گذار ادغام شده‌اند. اگر `provider.refund` موفق شود ولی `save` شکست بخورد، هیچ state machine برای «در انتظار تسویه» وجود ندارد و idempotency بازپرداخت شکننده است.
2. **`provider.refund` هیچ بررسی خطا ندارد.** اگر Zarinpal بازپرداخت را رد کند، exception بالا می‌آید و تراکنش در وضعیت قبلی می‌ماند، اما **رزرو قبلاً `cancelled` شده است** (`this.bookings.cancel` قبل از refund اجرا می‌شود). نتیجه: **یک تراکنش نیمه‌کاره — رزرو کنسل است، پول برنگشته و هیچ رکوردی از تلاش شکست‌خورده وجود ندارد.** این بزرگ‌ترین باگ معماری در ماژول پرداخت است.
3. **از دیتابیس transaction استفاده نمی‌کند.** سه عملیات (findOne، bookings.cancel، save) سه تراکنش جدا هستند. کل متد باید در یک `dataSource.transaction` با `setTenantContext` قرار گیرد.
4. **بدون `setTenantContext`** — `this.transactions.findOne({ where: { tenantId, bookingId } })` روی جدول تحت `FORCE RLS` بدون تنظیم GUC صفر ردیف برمی‌گرداند → `NotFoundException` بی‌دلیل.
5. **بازپرداخت دستی است.** هیچ cron یا queue‌ای برای «تسویه بازپرداخت‌های در انتظار» وجود ندارد. کارشناس پشتیبانی باید در پنل زارین‌پال دخالت دستی کند.
6. **خطا در حین refund بازگردانی نمی‌شود** → امکان باقی‌ماندن رکورد در وضعیت ناسازگار.

---

## ۴.۴ سیاست کنسلی و جریمه (تکرار خلاصه از بخش ۰۳)

از `backend\src\modules\booking\cancellation-policy.service.ts`:

| دلیل | بازپرداخت | متن دلیل |
| --- | --- | --- |
| `specialist_unavailable` | **۱۰۰٪** | «بازپرداخت کامل به دلیل مشکل از سمت ارائه‌دهنده» |
| `no_show` (عدم حضور مشتری) | **۰٪** | «عدم حضور مشتری — بدون بازپرداخت» |
| `customer_request` و ≥ ۲۴ ساعت | **۱۰۰٪** | «لغو بیش از ۲۴ ساعت قبل — بازپرداخت کامل» |
| `customer_request` و ۲ تا ۲۴ ساعت | **۵۰٪** | «لغو بین ۲ تا ۲۴ ساعت قبل — بازپرداخت ۵۰٪» |
| `customer_request` و < ۲ ساعت | **۰٪** | «لغو کمتر از ۲ ساعت قبل — بدون بازپرداخت» |

مرزها: `hours >= 24` و `hours >= 2` — یعنی «دقیقاً ۲۴ ساعت قبل» بازپرداخت کامل می‌گیرد و «دقیقاً ۲ ساعت قبل» ۵۰٪. `penaltyAmount = total - refundAmount`.

---

## ۴.۵ درگاه واقعی: `ZarinpalPaymentProvider`

از `backend\src\modules\payment\providers\zarinpal-payment.provider.ts`:

```ts
readonly name = 'zarinpal';
// کامنت کلاس: «درگاه ایرانی. پول به حساب پلتفرم میرسد؛ پرداخت به متخصص دستی است.»
```

| متد | رفتار |
| --- | --- |
| `createPaymentIntent` | `POST {base}/v4/payment/request.json` با `merchant_id`, `amount`, `description`, `callback_url` (+`bookingId`), `metadata`. کد `100` + `authority` لازم است؛ خروجی `redirectUrl = .../StartPay/{authority}` با `status: 'requires_action'`. |
| `verifyPayment` | `POST {base}/v4/payment/verify.json`. کد `100` **یا** `101` (already verified) → success با `refId`. |
| `refund` | **فقط log می‌کند:** `this.logger.warn('Zarinpal refund for ${...} needs manual settlement')` و `{ providerRefundId: 'manual-<authority>', status: 'pending' }` برمی‌گرداند. **هیچ تماس شبکه‌ای وجود ندارد.** |

- `baseUrl()` و `startPayUrl()` بین sandbox و production سوئیچ می‌کنند بر اساس `ZARINPAL_SANDBOX === 'true'`.
- `merchantId()`, `callbackUrl()` از `getOrThrow` استفاده می‌کنند → در فاز ۱ ضروری نیست (چون `assertEnabled` اول قطع می‌کند)، اما در فاز ۲ غیبت متغیر باعث شکست بوت می‌شود.

> **حقیقت تلخ دربارهٔ بازپرداخت:** `refund()` **هیچ پولی برنمی‌گرداند.** فقط یک warn می‌دهد و یک `providerRefundId` جعلی با پیشوند `manual-` می‌سازد. بنابراین `markRefundPending` در بدترین حالت دیتابیس را می‌گوید «بازپرداخت شد» در حالی که **هیچ ریالی جابه‌جا نشده است**. این دقیقاً همان چیزی است که منشور پروژه (فاز ۱ بدون بازپرداخت) پیش‌بینی کرده — ولی باید در گزارش برای مشاور بی‌ابهام باشد که در فاز دوم **باید** جایگزین شود، نه اینکه «نیمه‌کاره» بماند.

## ۴.۶ لایه HTTP و Feature Flag

`backend\src\modules\payment\payment.controller.ts`:

```ts
@ApiTags('payments')
@Controller('payments')
@UseGuards(PaymentFeatureFlag)
export class PaymentController {
  @Post('initiate')        initiate(@Body() body: InitiatePaymentDto)  // tenantId + bookingId (هر دو @IsUUID)
  @Get('zarinpal/callback') callback(@Query('Authority') authority = '', @Query('Status') status = '')
}
```

`backend\src\modules\payment\payment-flag.guard.ts`:

```ts
canActivate(): boolean {
  if (!this.payments.paymentsEnabled) {
    throw new ServiceUnavailableException('در فاز اول، پرداخت آنلاین فعال نیست');
  }
  return true;
}
```

- گارد **per-controller** است (نه global) تا کاتالوگ عمومی تحت تأثیر قرار نگیرد.
- کامنت صریح: `JwtAuthGuard` گلوبال است، پس فراخوانی پرداخت بدون توکن پیش از این گارد با `401` رد می‌شود — این گارد «دومین بررسی فاز-محور» است. **دفاع چندلایه درست.**
- **نکته قابل توجه درباره ABI:** `POST /payments/initiate` مقدار `tenantId` را از **بدنه درخواست** می‌گیرد، نه از توکن. این با الگوی «همه‌چیز از توکن» در بخش رزرو **مغایر** است. در فاز ۲ این یک ریسک جدی است: یک مشتری احرازشده می‌تواند `tenantId` هر سالنی را بفرستد. `PaymentService.initiate` هیچ بررسی‌ای نمی‌کند که `tenantId` بدنه با رزرو/توکن همخوان باشد. **این یک باگ امنیتی آماده-برای-فاز-۲ است.**

## ۴.۷ رابط پنل ادمین

`admin-panel\src\app\[locale]\(protected)\transactions\page.tsx` — یک **placeholder کامل**:

```tsx
/**
 * Phase 1 placeholder: the charter keeps payments off the platform
 * (`PAYMENTS_ENABLED=false`) — customers pay the salon directly, so there is
 * nothing to list. The gateway button is the Phase 2 hook, kept disabled.
 */
```

- جدول با `<td colSpan={4}>{t('empty')}</td>` خالی است.
- دکمه «فعال‌سازی درگاه» با `disabled` رندر می‌شود.
- هیچ فایل API برای تراکنش‌ها در `admin-panel\src\lib\api\` وجود ندارد (فهرست: `approvals`, `audit`, `auth`, `client`, `dashboard`, `errors`, `tenants`, `users`).

---

## ۴.۸ سؤال کلیدی برای مشاور: Stripe یا Zarinpal؟

بزرگ‌ترین تناقض بین اسناد و کد:

| منبع | ادعا |
| --- | --- |
| `README.md` خط ۹۱ | «Payments: `stripe` 22.6.2 — Stripe Connect split payments. Wrap it in `PaymentService`.» |
| `backend\package.json` | `"stripe": "22.6.2"` در dependencies |
| `backend\src\config\services.config.ts` | بلوک `stripeConfig` با `secretKey`, `webhookSecret`, `connectClientId` |
| `backend\src\config\env.validation.ts` | `STRIPE_SECRET_KEY` و `STRIPE_WEBHOOK_SECRET` **الزامی** |
| `backend\src\**` | ❌ **هیچ `import ... from 'stripe'`** |
| `PROJECT_CHARTER.md` | «پلتفرم درآمد تقسیم نمی‌کند» |
| `payment.module.ts` | provider واقعی `ZarinpalPaymentProvider` است |

سه پیامد عملی:

1. سازنده/مشاور ممکن است تصور کند Stripe Connect پیاده‌سازی شده. **نشده.**
2. `STRIPE_SECRET_KEY` الزامی است ولی مصرف نمی‌شود → بوت در محیطی که این متغیر را ندارد شکست می‌خورد بی‌دلیل.
3. منشور پروژه و README با هم در تضادند. **این تناقض باید در گزارش برای مشاور با صدای بلند مطرح شود.**

## ۴.۹ جدول شکاف‌های ماژول پرداخت

| # | شکاف | شدت |
| --- | --- | --- |
| P1 | `refund()` هیچ پولی برنمی‌گرداند (فقط warn + id جعلی) | **بالا** |
| P2 | `markRefundPending` بدون دیتابیس-تراکنش → رزرو کنسل می‌ماند اگر refund شکست بخورد | **بالا** |
| P3 | `markRefundPending` بدون `setTenantContext` → احتمال `NotFoundException` | **بالا** |
| P4 | `POST /payments/initiate` مقدار `tenantId` را از بدنه می‌گیرد، نه از توکن | **بالا** |
| P5 | Stripe در مستندات/env، Zarinpal در کد | متوسط |
| P6 | بدون queue/cron برای تسویه بازپرداخت | متوسط |
| P7 | بدون تست integration با درگاه (ولو sandbox) | **بالا** |
| P8 | `salonShare` کمیسیون پلتفرم را کسر نمی‌کند — نیاز به تأیید کسب‌وکار | متوسط |
| P9 | نبود webhook امضاشده (فقط redirect GET با `Authority`) | متوسط |
| P10 | پنل ادمین صفحه تراکنش‌ها هیچ API ندارد | کم (فاز ۱) |


