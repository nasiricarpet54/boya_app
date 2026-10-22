import { Construction } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

/**
 * Shell for the sections whose endpoints are not built yet. It renders the
 * page's real heading — only the body is a stub — so the route, the nav and
 * the layout can be reviewed before the API work lands.
 */
export function PlaceholderPage({
  description,
  statusLabel,
}: {
  description: string;
  statusLabel: string;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle text-brand-primary"
        >
          <Construction className="h-6 w-6" />
        </span>

        <div>
          <p className="text-title font-semibold text-ink">{description}</p>
          <Badge tone="brand" className="mt-3">
            {statusLabel}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
