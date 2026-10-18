import type { AuthSession } from '@digvation/business-auth';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAvatar, DButton, DDropdown } from '@digvation/ui';
import {
  BadgePercent,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  CircleUserRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
  UserRound,
  UserCircle,
  UsersRound,
  ContactRound,
  WalletCards,
  type LucideIcon,
  ChevronDown,
} from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useState } from 'react';

import { canAccessBackoffice, type BackofficeCapability } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BackofficePasswordLinkDialog } from '../../auth/backoffice-password-link-dialog';
import { ProfileDialog } from '../../modules/identity/ui/profile-dialog';
import { NotificationBell } from '../../modules/notifications';
import {
  type BackofficeMessageKey,
  useBackofficeLocalization,
} from '../localization/backoffice-localization';
import { ActiveBranchHeaderSelector } from './active-branch-header-selector';

interface NavigationItem {
  label: BackofficeMessageKey;
  localizedLabel?: { id: string; en: string };
  to: string;
  icon: LucideIcon;
  capability: BackofficeCapability;
}

const dashboardItem: NavigationItem = {
  label: 'dashboard',
  to: '/',
  icon: LayoutDashboard,
  capability: 'dashboard',
};

const activityItem: NavigationItem = {
  label: 'activity',
  to: '/activity',
  icon: ClipboardList,
  capability: 'activity',
};

const navigationSections: ReadonlyArray<{
  label: BackofficeMessageKey;
  items: readonly NavigationItem[];
}> = [
  {
    label: 'masterData',
    items: [
      { label: 'catalog', to: '/catalog', icon: Tags, capability: 'catalog' },
      {
        label: 'catalog',
        localizedLabel: { id: 'Diskon & promo', en: 'Discounts & promotions' },
        to: '/promotions',
        icon: BadgePercent,
        capability: 'promotions',
      },
      { label: 'employees', to: '/employees', icon: UsersRound, capability: 'employees' },
      {
        label: 'catalog',
        localizedLabel: { id: 'Pelanggan', en: 'Customers' },
        to: '/customers',
        icon: UserRound,
        capability: 'customers',
      },
      {
        label: 'catalog',
        localizedLabel: { id: 'Membership', en: 'Membership' },
        to: '/memberships',
        icon: ContactRound,
        capability: 'memberships',
      },
    ],
  },
  {
    label: 'finance',
    items: [
      {
        label: 'financialAccounts',
        to: '/financial-accounts',
        icon: WalletCards,
        capability: 'financialAccounts',
      },
      { label: 'expenses', to: '/expenses', icon: BookOpen, capability: 'expenses' },
    ],
  },
  {
    label: 'reporting',
    items: [
      {
        label: 'transactionHistory',
        to: '/transactions',
        icon: BookOpen,
        capability: 'transactions',
      },
      { label: 'reports', to: '/reports', icon: ChartNoAxesCombined, capability: 'reports' },
    ],
  },
  {
    label: 'configuration',
    items: [
      { label: 'business', to: '/business', icon: Building2, capability: 'configuration' },
      {
        label: 'accessControl',
        to: '/access-control',
        icon: CircleUserRound,
        capability: 'accessControl',
      },
    ],
  },
];

export function BackofficeShell() {
  const bootstrap = useDeploymentBootstrap();
  const { t, formatDate } = useBackofficeLocalization();
  const { session, logout } = useBackofficeAuth();
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeBranchSelectorOpen, setActiveBranchSelectorOpen] = useState(false);

  const [previousLocationKey, setPreviousLocationKey] = useState(location.key);
  if (previousLocationKey !== location.key) {
    setPreviousLocationKey(location.key);
    setMobileNavigationOpen(false);
    setAccountMenuOpen(false);
    setActiveBranchSelectorOpen(false);
  }

  if (!session) return null;

  const brandSubtitle = session.business.name || bootstrap.branding.companyName || 'Backoffice';
  const roleContext =
    session.identity.roles.map((role) => role.name).join(', ') || t('authenticatedUser');
  const currentDate = formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="backoffice-shell flex h-screen w-full min-w-0 overflow-hidden bg-(--color-background)">
      <aside className="backoffice-shell__sidebar hidden min-h-0 shrink-0 flex-col border-r border-(--color-border) bg-(--color-surface) shadow-[1px_0_0_var(--color-border)] md:flex md:w-58 lg:w-70">
        <div className="flex min-h-16 items-center gap-3 border-b border-(--color-border) px-5 py-3">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-(--radius-control) bg-(--color-brand)/10 text-(--color-brand)">
            {bootstrap.branding.logoUrl ? (
              <img
                src={bootstrap.branding.logoUrl}
                alt={`${bootstrap.branding.productName} logo`}
                className="size-full object-contain p-1"
              />
            ) : (
              <Building2 className="size-4.5" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-(--color-text)">
              {bootstrap.branding.productName}
            </p>
            <p className="truncate text-xs leading-4 text-(--color-text-muted)">{brandSubtitle}</p>
          </div>
        </div>

        <nav className="px-3 py-3">
          <NavigationGroups session={session} />
        </nav>

        <div className="mt-auto hidden border-t border-(--color-border) md:block">
          <div className="px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <DAvatar
                alt=""
                name={session.identity.displayName}
                fallback={<UserRound className="size-4" aria-label={t('userAccount')} />}
                size="sm"
                className="shrink-0 bg-(--color-brand)/10 text-xs font-bold text-(--color-brand)"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-5 text-(--color-text)">
                  {session.identity.displayName}
                </span>
                <span className="block truncate text-xs leading-4 text-(--color-text-muted)">
                  {roleContext}
                </span>
              </span>
            </div>
          </div>
          <div className="border-t border-(--color-border) px-3 py-2">
            <DButton
              variant="ghost"
              type="button"
              leftIcon={<LogOut className="size-4 shrink-0" />}
              onClick={() => void logout()}
              className="flex h-9 w-full items-center justify-start gap-2.5 px-3 text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)"
            >
              {t('logout')}
            </DButton>
          </div>
        </div>
      </aside>

      <main className="backoffice-shell__main flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-(--color-border) bg-(--color-surface) px-5 shadow-[0_1px_0_var(--color-border)] md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <div className="backoffice-shell__mobile-navigation md:hidden">
              <DDropdown
                open={mobileNavigationOpen}
                onOpenChange={setMobileNavigationOpen}
                placement="bottom-start"
                contentPadding={false}
                closeOnItemClick
                minWidth={0}
                contentClassName="w-[min(320px,calc(100vw-24px))] max-h-[calc(100vh-88px)] overflow-y-auto"
                trigger={() => (
                  <DButton variant="ghost" size="icon" aria-label={t('openNavigation')}>
                    <Menu className="size-4.5" />
                  </DButton>
                )}
              >
                <nav className="p-3">
                  <NavigationGroups session={session} />
                </nav>
              </DDropdown>
            </div>
            <ActiveBranchHeaderSelector
              open={activeBranchSelectorOpen}
              onOpenChange={setActiveBranchSelectorOpen}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <p className="backoffice-shell__header-date hidden text-xs text-(--color-text-muted) md:block">
              {currentDate}
            </p>
            <span
              className="backoffice-shell__header-metadata hidden h-5 w-px bg-(--color-border) md:block"
              aria-hidden="true"
            />
            <span className="backoffice-shell__header-status hidden items-center gap-1.5 text-xs text-(--color-text-muted) md:flex">
              <span className="size-1.5 rounded-full bg-(--color-success)" aria-hidden="true" />
              {t('online')}
            </span>
            <NotificationBell />
            <DDropdown
              open={accountMenuOpen}
              onOpenChange={setAccountMenuOpen}
              placement="bottom-end"
              contentPadding={false}
              minWidth={240}
              closeOnItemClick
              trigger={() => (
                <button
                  type="button"
                  className={`flex h-9 items-center gap-1 rounded-full border-0 px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus) ${accountMenuOpen ? 'bg-(--color-surface-muted)' : 'bg-(--color-surface-muted)/75 hover:bg-(--color-surface-muted)'}`}
                  aria-label={t('openAccountMenu')}
                  aria-expanded={accountMenuOpen}
                >
                  <DAvatar
                    alt=""
                    name={session.identity.displayName}
                    fallback={
                      session.identity.displayName.trim() ? undefined : (
                        <UserRound className="size-4" aria-label={t('userAccount')} />
                      )
                    }
                    size="sm"
                    className="shrink-0 bg-transparent text-xs font-bold text-(--color-brand) [&_*]:border-0 [&_*]:bg-transparent"
                  />
                  <ChevronDown className="size-3.5 text-(--color-text-muted)" aria-hidden="true" />
                </button>
              )}
            >
              <div className="p-1.5">
                <div className="border-b border-(--color-border) px-2.5 py-2.5">
                  <p className="truncate text-sm font-semibold text-(--color-text)">
                    {session.identity.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-(--color-text-muted)">{roleContext}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setProfileOpen(true);
                  }}
                  className="mt-1 flex h-9 w-full items-center gap-2 rounded-(--radius-control) px-2.5 text-left text-sm text-(--color-text) hover:bg-(--color-surface-muted)"
                >
                  <UserCircle className="size-4" />
                  {t('profile')}
                </button>
                <div className="my-1 border-t border-(--color-border)" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void logout()}
                  className="flex h-9 w-full items-center gap-2 rounded-(--radius-control) px-2.5 text-left text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted)"
                >
                  <LogOut className="size-4" />
                  {t('logout')}
                </button>
              </div>
            </DDropdown>
          </div>
        </header>
        <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </main>
      <ProfileDialog
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onRequestPasswordLink={() => setChangePasswordOpen(true)}
      />
      <BackofficePasswordLinkDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </div>
  );
}

function NavigationGroups({ session }: { session: AuthSession }) {
  const { t } = useBackofficeLocalization();
  return (
    <>
      <div className="mb-3">
        <NavigationLink item={dashboardItem} />
      </div>
      {navigationSections.map((section) => {
        const items = section.items.filter((item) => canAccessBackoffice(session, item.capability));
        if (!items.length) return null;
        return (
          <div key={section.label} className="mt-3">
            <p className="px-3 pb-1 text-[12px] font-semibold text-(--color-text-muted)">
              {t(section.label)}
            </p>
            <div className="space-y-0.5 pl-3">
              {items.map((item) => (
                <NavigationLink key={item.to} item={item} nested />
              ))}
            </div>
          </div>
        );
      })}
      {canAccessBackoffice(session, 'activity') ? (
        <div className="mt-3">
          <NavigationLink item={activityItem} />
        </div>
      ) : null}
    </>
  );
}

function NavigationLink({ item, nested = false }: { item: NavigationItem; nested?: boolean }) {
  const { t, locale } = useBackofficeLocalization();
  const Icon = item.icon;
  const label = item.localizedLabel?.[locale] ?? t(item.label);
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'flex h-9 items-center justify-start gap-2 rounded-(--radius-control) text-sm font-medium transition-colors duration-150',
          nested ? 'px-3' : 'px-3',
          isActive
            ? 'bg-(--color-brand)/10 text-(--color-brand)'
            : 'text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)',
        ].join(' ')
      }
    >
      <Icon className="size-4.5 shrink-0" />
      {label}
    </NavLink>
  );
}
