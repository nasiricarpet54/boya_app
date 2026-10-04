export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-headline font-bold text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-body text-ink-muted">{subtitle}</p> : null}
    </div>
  );
}
