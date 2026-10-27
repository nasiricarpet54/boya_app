import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Mail,
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
 *
 * `children` nests a filtered view under a parent item (e.g. "Mobile
 * Specialists" under "Users"). A child keeps the parent's icon and is rendered
 * indented; clicking it navigates to its own href but counts as active for the
 * parent too, so the section stays highlighted.
 */
export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  /** Marks the approval queue, the one item with live work behind it. */
  showsApprovalBadge?: boolean;
  /** Nested filtered views of the parent resource. */
  children?: NavItem[];
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
      {
        href: '/users',
        icon: Users,
        labelKey: 'users',
        children: [
          // "Mobile Specialists" is a role-filtered view of the user list, not
          // a separate resource — the backend serves it as `role=freelance_mobile`.
          { href: '/users?role=freelance_mobile', icon: Users, labelKey: 'mobileSpecialists' },
        ],
      },
      { href: '/invites', icon: Mail, labelKey: 'invites' },
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
