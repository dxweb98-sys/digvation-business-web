import { useRuntime } from '@digvation/business-runtime';
import { DAvatar, DBadge, DButton, DDropdown } from '@digvation/ui';
import {
  Bell,
  BadgePercent,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CircleUserRound,
  Globe2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Tags,
  UserRound,
  UserCircle,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { canAccessBackoffice, type BackofficeCapability } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import type { BackofficeSession } from '../../auth/auth-session';
import {
  type BackofficeMessageKey,
  useBackofficeLocalization,
} from '../localization/backoffice-localization';
import { ActiveBranchHeaderSelector } from './active-branch-header-selector';

interface NavigationItem {
  label: BackofficeMessageKey;
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

const navigationSections: ReadonlyArray<{
  label: BackofficeMessageKey;
  items: readonly NavigationItem[];
}> = [
  {
    label: 'masterData',
    items: [
      { label: 'catalog', to: '/catalog', icon: Tags, capability: 'catalog' },
      { label: 'employees', to: '/employees', icon: UsersRound, capability: 'employees' },
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
      { label: 'tax', to: '/tax', icon: BadgePercent, capability: 'tax' },
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
  const runtime = useRuntime();
  const { locale, setLocale, t, formatDate } = useBackofficeLocalization();
  const { session, logout } = useBackofficeAuth();
  if (!session) return null;

  const brandSubtitle =
    runtime.branding.businessName ?? runtime.branding.companyName ?? 'Backoffice';
  const roleContext =
    session.identity.roles.map((role) => role.name).join(', ') || t('authenticatedUser');
  const currentDate = formatDate(new Date(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="backoffice-shell flex h-screen w-full min-w-0 overflow-hidden bg-[var(--color-background)]">
      <aside className="backoffice-shell__sidebar hidden min-h-0 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-[1px_0_0_var(--color-border)] md:flex md:w-[232px] lg:w-[280px]">
        <div className="flex min-h-16 items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            {runtime.branding.logoUrl ? (
              <img
                src={runtime.branding.logoUrl}
                alt={`${runtime.branding.productName} logo`}
                className="size-full object-contain p-1"
              />
            ) : (
              <Building2 className="size-[18px]" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
              {runtime.branding.productName}
            </p>
            <p className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
              {brandSubtitle}
            </p>
          </div>
        </div>

        <nav className="px-3 py-3">
          <NavigationGroups session={session} />
        </nav>

        <div className="mt-auto hidden border-t border-[var(--color-border)] md:block">
          <div className="px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <DAvatar
                alt=""
                name={session.identity.displayName}
                fallback={<UserRound className="size-4" aria-label={t('userAccount')} />}
                size="sm"
                className="shrink-0 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-5 text-[var(--color-text)]">
                  {session.identity.displayName}
                </span>
                <span className="block truncate text-xs leading-4 text-[var(--color-text-muted)]">
                  {roleContext}
                </span>
              </span>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] px-3 py-2">
            <DButton
              variant="ghost"
              type="button"
              leftIcon={<LogOut className="size-4 shrink-0" />}
              onClick={() => void logout()}
              className="flex h-9 w-full items-center justify-start gap-2.5 px-3 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
            >
              {t('logout')}
            </DButton>
          </div>
        </div>
      </aside>

      <main className="backoffice-shell__main flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 shadow-[0_1px_0_var(--color-border)] md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <div className="backoffice-shell__mobile-navigation md:hidden">
              <DDropdown
                placement="bottom-start"
                contentPadding={false}
                closeOnItemClick
                minWidth={0}
                contentClassName="w-[min(320px,calc(100vw-24px))] max-h-[calc(100vh-88px)] overflow-y-auto"
                trigger={() => (
                  <DButton variant="ghost" size="icon" aria-label={t('openNavigation')}>
                    <Menu className="size-[18px]" />
                  </DButton>
                )}
              >
                <nav className="p-3">
                  <NavigationGroups session={session} />
                </nav>
              </DDropdown>
            </div>
            <ActiveBranchHeaderSelector />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <p className="backoffice-shell__header-date hidden text-xs text-[var(--color-text-muted)] md:block">
              {currentDate}
            </p>
            <span
              className="backoffice-shell__header-metadata hidden h-5 w-px bg-[var(--color-border)] md:block"
              aria-hidden="true"
            />
            <DBadge
              variant="outline"
              className="backoffice-shell__header-workspace hidden md:inline-flex"
            >
              {session.identity.workspace}
            </DBadge>
            <span className="backoffice-shell__header-status hidden items-center gap-1.5 text-xs text-[var(--color-text-muted)] md:flex">
              <span
                className="size-1.5 rounded-full bg-[var(--color-success)]"
                aria-hidden="true"
              />
              {t('online')}
            </span>
            <DButton variant="ghost" size="icon" aria-label={t('notifications')}>
              <Bell className="size-[18px]" />
            </DButton>
            <DDropdown
              placement="bottom-end"
              contentPadding={false}
              minWidth={240}
              closeOnItemClick
              trigger={() => (
                <button
                  type="button"
                  className="grid size-9 place-items-center border-0 bg-transparent p-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25"
                  aria-label={t('openAccountMenu')}
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
                    className="shrink-0 text-xs font-bold text-[var(--color-brand)]"
                  />
                </button>
              )}
            >
              <div className="p-1.5">
                <div className="border-b border-[var(--color-border)] px-2.5 py-2.5">
                  <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                    {session.identity.displayName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                    {roleContext}
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="mt-1 flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-sm text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserCircle className="size-4" />
                  {t('profile')}
                </button>
                <button
                  type="button"
                  disabled
                  className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-sm text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <KeyRound className="size-4" />
                  {t('changePassword')}
                </button>
                <div className="my-1 border-t border-[var(--color-border)]" />
                <div className="px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]">
                  {t('language')}
                </div>
                {(['id', 'en'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={locale === option}
                    onClick={() => setLocale(option)}
                    className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                  >
                    <Globe2 className="size-4" />
                    {option === 'id' ? t('indonesian') : t('english')}
                  </button>
                ))}
                <div className="my-1 border-t border-[var(--color-border)]" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void logout()}
                  className="flex h-9 w-full items-center gap-2 rounded-[var(--radius-control)] px-2.5 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
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
    </div>
  );
}

function NavigationGroups({ session }: { session: BackofficeSession }) {
  const { t } = useBackofficeLocalization();
  return (
    <>
      <div className="mb-3">
        <NavigationLink item={dashboardItem} />
      </div>
      {navigationSections.map((section) => {
        const items = section.items.filter((item) =>
          canAccessBackoffice(session, item.capability),
        );
        if (!items.length) return null;
        return (
          <div key={section.label} className="mt-3">
            <p className="px-3 pb-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
              {t(section.label)}
            </p>
            <div className="space-y-0.5 pl-3">
              {items.map((item) => (
                <NavigationLink key={item.label} item={item} nested />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function NavigationLink({ item, nested = false }: { item: NavigationItem; nested?: boolean }) {
  const { t } = useBackofficeLocalization();
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'flex h-9 items-center justify-start gap-2 rounded-[var(--radius-control)] text-sm font-medium transition-colors duration-150',
          nested ? 'px-3' : 'px-3',
          isActive
            ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
        ].join(' ')
      }
    >
      <Icon className="size-[18px] shrink-0" />
      {t(item.label)}
    </NavLink>
  );
}
