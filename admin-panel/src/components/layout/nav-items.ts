import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Mail,
  Receipt,
  ScrollText,
  Settings,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey: string;
  showsApprovalBadge?: boolean;
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
          { href: '/mobile-specialists', icon: UserCheck, labelKey: 'mobileSpecialists' },
        ],
      },
      { href: '/specialists', icon: UserCheck, labelKey: 'specialists' },
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