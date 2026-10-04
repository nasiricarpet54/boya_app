'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/providers/ToastProvider';
import { ADMIN_ROLE } from '@/lib/constants';
import { authApi } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/api/errors';
import { useRouter } from '@/lib/navigation';
import { useAuthStore } from '@/lib/stores/auth';
import { faDigits, isValidPhone, normalizePhone, toLatinDigits } from '@/lib/utils/persian';

/**
 * The backend throttles `POST /auth/otp/send` to 3 requests per 10 minutes per
 * number. A one-minute local cooldown stops a retry from burning that whole
 * quota and locking the admin out.
 */
const RESEND_COOLDOWN_SECONDS = 60;

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const tLogin = useTranslations('login');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const { toast } = useToast();
  const router = useRouter();

  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  /** The normalised number the OTP was actually requested for. */
  const [pendingPhone, setPendingPhone] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // An admin who still holds a live session has no business on this page.
  useEffect(() => {
    if (isHydrated && token && user?.role === ADMIN_ROLE) {
      router.replace('/dashboard');
    }
  }, [isHydrated, token, user, router]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = useCallback(async () => {
    const normalized = normalizePhone(phone);

    if (!isValidPhone(normalized)) {
      setError(tErrors('phoneInvalid'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await authApi.sendOtp(normalized);

      setPendingPhone(normalized);
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast({ title: tLogin('otpTitle'), variant: 'success' });
    } catch (cause) {
      setError(getApiErrorMessage(cause, tErrors('generic')));
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, toast, tErrors, tLogin]);

  const handleVerify = useCallback(async () => {
    // Persian digits are accepted here. The API's DTO normalises them too, but
    // sending Latin keeps failure handling on one side of the wire.
    const normalizedCode = toLatinDigits(code).replace(/\D/g, '');

    if (normalizedCode.length !== 6) {
      setError(tErrors('otpLength'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { token: accessToken, user: authUser } = await authApi.verifyOtp(
        pendingPhone,
        normalizedCode,
      );

      if (authUser.role !== ADMIN_ROLE) {
        // The token is genuine but useless here. It is dropped before it can
        // reach storage, so a customer account can never open the panel.
        logout();
        setAccessDenied(true);
        return;
      }

      setAuth(accessToken, {
        id: authUser.id,
        phoneNumber: authUser.phoneNumber,
        fullName: authUser.fullName,
        role: authUser.role,
        tenantId: authUser.tenantId,
      });

      toast({ title: tCommon('appName'), description: tLogin('title'), variant: 'success' });
      router.replace('/dashboard');
    } catch (cause) {
      setError(getApiErrorMessage(cause, tErrors('generic')));
    } finally {
      setIsSubmitting(false);
    }
  }, [code, pendingPhone, logout, setAuth, toast, router, tCommon, tErrors, tLogin]);

  const handleBackToPhone = useCallback(() => {
    setStep('phone');
    setCode('');
    setError(null);
    setCooldown(0);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <span
            aria-hidden
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-copper text-headline font-bold text-white"
          >
            ب
          </span>
          <h1 className="text-headline font-bold text-ink">{tLogin('title')}</h1>
          <p className="mt-2 text-caption text-ink-muted">{tLogin('subtitle')}</p>
        </header>

        <div className="rounded-lg bg-surface p-6 shadow-1">
          {accessDenied ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error"
              >
                <ShieldAlert className="h-6 w-6" />
              </span>

              <div>
                <p className="text-title font-semibold text-ink">{tAuth('adminOnly')}</p>
                <p className="mt-2 text-caption text-ink-muted">{tAuth('adminOnlyHint')}</p>
              </div>

              <Button variant="secondary" onClick={() => setAccessDenied(false)}>
                {tLogin('changeNumber')}
              </Button>
            </div>
          ) : step === 'phone' ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSendOtp();
              }}
            >
              <Input
                label={tLogin('phoneLabel')}
                placeholder={tLogin('phonePlaceholder')}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                numeric
                disabled={isSubmitting}
                hint={tLogin('notice')}
                error={error ?? undefined}
              />

              <Button type="submit" fullWidth disabled={isSubmitting}>
                {isSubmitting ? tCommon('loading') : tLogin('sendOtp')}
              </Button>

              <p className="text-overline text-ink-muted">{tLogin('devHint')}</p>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleVerify();
              }}
            >
              <div>
                <h2 className="text-title font-semibold text-ink">{tLogin('otpTitle')}</h2>
                <p className="mt-1 text-caption text-ink-muted">
                  {tLogin('otpSubtitle', { phone: faDigits(pendingPhone) })}
                </p>
              </div>

              <Input
                label={tLogin('otpLabel')}
                placeholder="۱۲۳۴۵۶"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                numeric
                disabled={isSubmitting}
                error={error ?? undefined}
              />

              <Button type="submit" fullWidth disabled={isSubmitting}>
                {isSubmitting ? tCommon('loading') : tLogin('verify')}
              </Button>

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToPhone}
                  disabled={isSubmitting}
                >
                  {/* Directional icon, mirrored by the RTL document. */}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                  {tLogin('changeNumber')}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSubmitting || cooldown > 0}
                  onClick={() => void handleSendOtp()}
                >
                  {cooldown > 0
                    ? `${tLogin('resend')} (${faDigits(cooldown)})`
                    : tLogin('resend')}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
