import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Receipt,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Sidebar structure.
 *
 * Keys are relative to the `nav` namespace in `messages/*.json`, so a label
 * rename never touches this file. Hrefs are locale-less on purpose — they go
 * through `Link` from `@/lib/navigation`, which adds the active locale prefix.
 */
export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  /** Marks the approval queue, the one item with live work behind it. */
  showsApprovalBadge?: boolean;
}

export interface NavSection {
  titleKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: 'sections.main',
    items: [{ href: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard' }],
  },
  {
    titleKey: 'sections.manage',
    items: [
      {
        href: '/approvals',
        icon: ClipboardCheck,
        labelKey: 'approvals',
        showsApprovalBadge: true,
      },
      { href: '/tenants', icon: Building2, labelKey: 'tenants' },
      { href: '/users', icon: Users, labelKey: 'users' },
      { href: '/transactions', icon: Receipt, labelKey: 'transactions' },
    ],
  },
  {
    titleKey: 'sections.system',
    items: [
      { href: '/audit-logs', icon: ScrollText, labelKey: 'auditLogs' },
      { href: '/settings', icon: Settings, labelKey: 'settings' },
    ],
  },
];
