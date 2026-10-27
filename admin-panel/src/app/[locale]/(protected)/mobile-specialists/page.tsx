import { redirect } from 'next-intl/server';

import { routing } from '@/routing';

/**
 * Redirects the old root-level route to the new filtered view. The path is
 * kept so bookmarks, deep links and the `/admin/specialists/mobile` endpoint
 * keep working after the nav refactor.
 */
export default async function MobileSpecialistsRedirect({ params }: { params: { locale: string } }) {
  redirect('/users?role=freelance_mobile');
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
