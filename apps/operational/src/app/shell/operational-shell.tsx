import { hasSessionFeature, useAuth } from '@digvation/business-auth';
import { useConnectivity, useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAvatar, DButton, DDialog, DDropdown, useToast } from '@digvation/ui';
import { Building2, ChevronDown, Check, LogOut, MapPin, Menu, UserCircle, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { useOperationalLocalization } from '../localization/operational-localization';
import { OperationalNotificationBell } from '../../features/notifications/operational-notification-bell';
import { useOperationalAccessContext } from '../../shared/operational-access/operational-access-api';
import { OperationalProfileDialog } from './operational-profile-dialog';
import type { OperationalNavigationSection } from '../../shared/navigation/operational-navigation';
import { resolveOperationalLocationSelection } from '../../shared/operational-access/operational-location-selection';
import { useOperationalSession } from '../../shared/operational-access/operational-session-provider';

function formatCurrentDate(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function identityInitials(displayName: string): string | null {
  const derived = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
  return derived || null;
}

interface OperationalShellProps {
  navigationSections: readonly OperationalNavigationSection[];
}

export function OperationalShell({ navigationSections }: OperationalShellProps) {
  const bootstrap = useDeploymentBootstrap();
  const connectivity = useConnectivity();
  const { copy, label } = useOperationalLocalization();
  const { session, logout, authPort } = useAuth();
  const { showToast } = useToast();
  const [isLoggingOut, setLoggingOut] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const {
    selectedLocationId,
    selectLocation,
    isBranchPickerOpen,
    openBranchPicker,
    closeBranchPicker,
  } = useOperationalSession();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const operationalAccessQuery = useOperationalAccessContext();
  const canSwitchBranches = hasSessionFeature(session.access, 'MULTI_BRANCH');
  const locations = useMemo(() => {
    const all = operationalAccessQuery.data?.locations ?? [];
    if (canSwitchBranches) return all;
    const main = all.find(
      (location) => location.id === operationalAccessQuery.data?.mainLocationId,
    );
    return main ? [main] : [];
  }, [canSwitchBranches, operationalAccessQuery.data]);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const brandSubtitle =
    session.business.name || bootstrap.branding.companyName || copy('Operational');
  const userInitials = identityInitials(session.identity.displayName);
  const primaryRole = session.identity.roles[0] ?? null;
  const roleContext = primaryRole?.name ?? copy('Account');

  useEffect(() => {
    const resolved = resolveOperationalLocationSelection(
      locations,
      selectedLocationId,
      operationalAccessQuery.data?.mainLocationId ?? null,
    );
    if (resolved !== selectedLocationId) selectLocation(resolved);
  }, [locations, operationalAccessQuery.data?.mainLocationId, selectLocation, selectedLocationId]);

  if (operationalAccessQuery.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-(--color-background) p-6 text-center">
        <section className="max-w-md rounded-xl border border-(--color-border) bg-(--color-surface) p-6">
          <h1 className="text-lg font-semibold">
            {copy('Operational access could not be loaded')}
          </h1>
          <p className="mt-2 text-sm text-(--color-text-muted)">
            {copy('Check your connection and try again.')}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <DButton variant="secondary" onClick={() => void logout()}>
              {copy('Logout')}
            </DButton>
            <DButton
              loading={operationalAccessQuery.isFetching}
              onClick={() => void operationalAccessQuery.refetch()}
            >
              {copy('Try again')}
            </DButton>
          </div>
        </section>
      </main>
    );
  }

  if (operationalAccessQuery.isSuccess && locations.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-(--color-background) p-6 text-center">
        <section className="max-w-md rounded-xl border border-(--color-border) bg-(--color-surface) p-6">
          <h1 className="text-lg font-semibold">
            {copy('Operational location access unavailable')}
          </h1>
          <p className="mt-2 text-sm text-(--color-text-muted)">
            {copy('This account has no authorized operational location.')}
          </p>
          <p className="mt-2 text-sm text-(--color-text-muted)">
            {copy(
              'Ask your business administrator to grant location access in Backoffice, then sign in again.',
            )}
          </p>
          <DButton className="mt-5" variant="secondary" onClick={() => void logout()}>
            {copy('Logout')}
          </DButton>
        </section>
      </main>
    );
  }

  const handleLocationSelect = (locationId: string) => {
    if (locationId === selectedLocationId) {
      closeBranchPicker();
      return;
    }

    if (/^\/sell\/[^/]+$/.test(routerLocation.pathname)) {
      const confirmed = window.confirm(
        copy(
          'Changing branch leaves the current transaction open and starts a new transaction. Continue?',
        ),
      );
      if (!confirmed) return;
      navigate('/sell');
    }

    selectLocation(locationId);
    closeBranchPicker();
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
      showToast({
        title: copy('Logout failed'),
        description: copy('Try again.'),
        variant: 'danger',
      });
    }
  };

  const accountMenu = (
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
          aria-label={copy('Open account information')}
          aria-haspopup="menu"
          aria-expanded={accountMenuOpen}
          className={`flex h-9 items-center gap-1 rounded-full border-0 px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus) ${accountMenuOpen ? 'bg-(--color-surface-muted)' : 'bg-(--color-surface-muted)/75 hover:bg-(--color-surface-muted)'}`}
        >
          <DAvatar
            alt=""
            name={session.identity.displayName}
            fallback={userInitials ?? <UserRound className="size-4" aria-hidden="true" />}
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
          className="mt-1 flex h-9 w-full items-center gap-2 rounded-(--radius-control) px-2.5 text-left text-sm text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus)"
        >
          <UserCircle className="size-4" aria-hidden="true" />
          {copy('Profile')}
        </button>
        <div className="my-1 border-t border-(--color-border)" />
        <button
          type="button"
          role="menuitem"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="flex h-9 w-full items-center gap-2 rounded-(--radius-control) px-2.5 text-left text-sm font-medium text-(--color-text) hover:bg-(--color-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus) disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {copy('Logout')}
        </button>
      </div>
    </DDropdown>
  );

  const branchLabel =
    selectedLocation?.name ??
    copy(operationalAccessQuery.isLoading ? 'Loading branch' : 'Choose branch');

  return (
    <div className="operational-shell flex h-screen w-full min-w-0 overflow-hidden bg-(--color-background)">
      <aside className="operational-shell__sidebar hidden min-h-0 shrink-0 flex-col border-r border-(--color-border) bg-(--color-surface) shadow-[1px_0_0_var(--color-border)] md:flex md:w-58 lg:w-70">
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

        <div className="px-3 pt-3">
          <BranchButton
            branchLabel={branchLabel}
            canChoose={locations.length > 1}
            onClick={openBranchPicker}
          />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <OperationalNavigationGroups navigationSections={navigationSections} />
        </nav>
      </aside>

      <main className="operational-shell__main flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-(--color-border) bg-(--color-surface) px-5 shadow-[0_1px_0_var(--color-border)] md:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <div className="operational-shell__mobile-navigation md:hidden">
              <DDropdown
                placement="bottom-start"
                contentPadding={false}
                closeOnItemClick
                minWidth={0}
                contentClassName="w-[min(320px,calc(100vw-24px))] max-h-[calc(100vh-88px)] overflow-y-auto"
                trigger={() => (
                  <DButton variant="ghost" size="icon" aria-label={copy('Open navigation')}>
                    <Menu className="size-4.5" />
                  </DButton>
                )}
              >
                <div className="border-b border-(--color-border) p-3">
                  <BranchButton
                    branchLabel={branchLabel}
                    canChoose={locations.length > 1}
                    onClick={openBranchPicker}
                  />
                </div>
                <nav className="p-3">
                  <OperationalNavigationGroups navigationSections={navigationSections} />
                </nav>
              </DDropdown>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
                connectivity.state === 'OFFLINE'
                  ? 'bg-(--color-accent-coral)/45'
                  : 'bg-(--color-accent-mint)/55'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" /> {label(connectivity.state)}
            </span>
            <span className="operational-shell__header-date hidden text-xs text-(--color-text-muted) md:inline">
              {formatCurrentDate(session.preferences.locale)}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <OperationalNotificationBell />
            {accountMenu}
          </div>
        </header>

        <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </main>

      <DDialog
        open={isBranchPickerOpen}
        onClose={closeBranchPicker}
        ariaLabel={copy('Choose active branch')}
        closeOnEscape
        closeOnOverlay
        showClose={false}
        noPadding
        className="w-full max-w-md rounded-t-(--radius-panel) bg-(--color-surface) shadow-2xl sm:rounded-(--radius-panel)"
      >
        <div className="border-b border-(--color-border) px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--color-brand)">
            {copy('Branch')}
          </p>
          <h2 className="mt-1 text-lg font-bold">{copy('Choose active branch')}</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            {copy('Select the location used for your active operation.')}
          </p>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto p-3">
          {operationalAccessQuery.isLoading ? (
            <p className="p-3 text-sm text-(--color-text-muted)">{copy('Loading branches...')}</p>
          ) : locations.length === 0 ? (
            <div className="p-3 text-sm text-(--color-text-muted)">
              {copy('No active branches are available for this workspace.')}
            </div>
          ) : (
            <div className="space-y-1">
              {locations.map((location) => {
                const isSelected = location.id === selectedLocationId;
                return (
                  <DButton
                    variant="ghost"
                    key={location.id}
                    type="button"
                    onClick={() => handleLocationSelect(location.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-(--radius-control) px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus) ${
                      isSelected
                        ? 'bg-(--color-brand)/10 text-(--color-brand)'
                        : 'hover:bg-(--color-surface-muted)'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <MapPin className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {location.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-(--color-text-muted)">
                          {location.code}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="size-4 shrink-0" /> : null}
                  </DButton>
                );
              })}
            </div>
          )}
        </div>
        <div className="border-t border-(--color-border) px-5 py-3 text-right">
          <DButton variant="secondary" onClick={closeBranchPicker}>
            {copy('Close')}
          </DButton>
        </div>
      </DDialog>

      <OperationalProfileDialog
        open={isProfileOpen}
        onClose={() => setProfileOpen(false)}
        apiBaseUrl={bootstrap.apiBaseUrl}
        getAccessToken={() => authPort.getAccessToken?.() ?? Promise.resolve(null)}
      />
    </div>
  );
}

function BranchButton({
  branchLabel,
  canChoose,
  onClick,
}: {
  branchLabel: string;
  canChoose: boolean;
  onClick: () => void;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canChoose}
      aria-label={`${copy('Active branch')} ${branchLabel}`}
      className="flex min-w-0 w-full items-center gap-2.5 rounded-(--radius-control) border border-(--color-border) bg-(--color-surface-muted)/55 px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 enabled:hover:border-(--color-brand)/30 enabled:hover:bg-(--color-surface-muted) disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus)"
    >
      <MapPin className="size-3.5 shrink-0 text-(--color-brand)" />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-(--color-text-muted)">
          {copy('Active branch')}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-(--color-text)">
          {branchLabel}
        </span>
      </span>
      {canChoose ? <ChevronDown className="size-3.5 shrink-0 text-(--color-text-muted)" /> : null}
    </button>
  );
}

function OperationalNavigationGroups({
  navigationSections,
}: {
  navigationSections: readonly OperationalNavigationSection[];
}) {
  return (
    <>
      {navigationSections.map((section) => (
        <div key={section.label} className="mt-3 first:mt-0">
          <p className="px-3 pb-1 text-[12px] font-semibold text-(--color-text-muted)">
            {section.label}
          </p>
          <div className="space-y-0.5 pl-3">
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex h-9 items-center justify-start gap-2 rounded-(--radius-control) px-3 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-(--color-brand)/10 text-(--color-brand)'
                      : 'text-(--color-text-muted) hover:bg-(--color-surface-muted) hover:text-(--color-text)',
                  ].join(' ')
                }
              >
                <Icon className="size-4.5 shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
