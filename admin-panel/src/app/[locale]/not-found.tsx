import { Button } from '@/components/ui/Button';
import { Link } from '@/lib/navigation';

/**
 * Rendered for an unknown path inside the `[locale]` segment, and for a locale
 * the router does not know. Deliberately static: the 404 path has no reliable
 * locale context to translate from, and a hard-coded Persian message is the
 * product default anyway.
 */
export default function LocaleNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-display font-bold text-ink">۴۰۴</p>
        <p className="text-title font-semibold text-ink">صفحه مورد نظر پیدا نشد.</p>
        <p className="text-caption text-ink-muted">
          نشانی وارد شده وجود ندارد یا تغییر کرده است.
        </p>

        <Link href="/dashboard">
          <Button variant="secondary">بازگشت به داشبورد</Button>
        </Link>
      </div>
    </main>
  );
}
