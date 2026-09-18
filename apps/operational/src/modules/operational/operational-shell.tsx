import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useConnectivity, useDeploymentBootstrap } from '@digvation/business-runtime';
import { DAlert, DAvatar, DButton, DDialog, DDropdown, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  ChevronDown,
  KeyRound,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { referenceQueryPolicy } from '../../app/data/operational-cache-policy';
import { useOperationalLocalization } from '../../app/localization/operational-localization';
import { getAppVersion } from '../../app/version/app-version';
import { OperationalNotificationBell } from '../notifications/operational-notification-bell';
import { OperationalAccessApi, operationalAccessKeys } from './operational-access-api';
import {
  PasswordChangeUnavailableError,
  unavailablePasswordChange,
  type OperationalPasswordChangePort,
} from './operational-password-change';
import type { OperationalNavigationSection } from './operational-navigation';
import { resolveOperationalLocationSelection } from './operational-location-selection';
import { useOperationalSession } from './operational-session-provider';

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
  /** Integration point for the Runtime-backed WhatsApp password-reset engine. */
  passwordChange?: OperationalPasswordChangePort;
}

export function OperationalShell({
  navigationSections,
  passwordChange = unavailablePasswordChange,
}: OperationalShellProps) {
  const bootstrap = useDeploymentBootstrap();
  const connectivity = useConnectivity();
  const { copy, label } = useOperationalLocalization();
  const { session, authPort, logout } = useAuth();
  const { showToast } = useToast();
  const [isLoggingOut, setLoggingOut] = useState(false);
  const [isAccountDialogOpen, setAccountDialogOpen] = useState(false);
  const [resetLinkState, setResetLinkState] = useState<
    { kind: 'idle' | 'pending' | 'sent' } | { kind: 'failed'; reason: 'unavailable' | 'failed' }
  >({ kind: 'idle' });
  const {
    selectedLocationId,
    selectLocation,
    isBranchPickerOpen,
    openBranchPicker,
    closeBranchPicker,
  } = useOperationalSession();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const version = getAppVersion();
  const operationalAccess = useMemo(
    () =>
      new OperationalAccessApi(
        new ApiClient({
          baseUrl: bootstrap.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, bootstrap.apiBaseUrl],
  );
  const operationalAccessQuery = useQuery({
    queryKey: operationalAccessKeys.context(),
    queryFn: ({ signal }) => operationalAccess.context(signal),
    ...referenceQueryPolicy,
  });
  const locations = useMemo(
    () => operationalAccessQuery.data?.locations ?? [],
    [operationalAccessQuery.data],
  );
  const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? null;
  const brandSubtitle =
    session.business.name || bootstrap.branding.companyName || copy('Operational');
  const userInitials = identityInitials(session.identity.displayName);
  const primaryRole = session.identity.roles[0] ?? null;
  const usernameLabel = session.identity.username?.trim()
    ? `@${session.identity.username.trim()}`
    : null;
  const userContextLabel = [usernameLabel, primaryRole?.name ?? null].filter(Boolean).join(' · ');
  const headerIdentityContext = userContextLabel || copy('Account');

  useEffect(() => {
    const resolved = resolveOperationalLocationSelection(
      locations,
      selectedLocationId,
      operationalAccessQuery.data?.mainLocationId ?? null,
    );
    if (resolved !== selectedLocationId) selectLocation(resolved);
  }, [locations, operationalAccessQuery.data?.mainLocationId, selectLocation, selectedLocationId]);

  if (operationalAccessQuery.isSuccess && locations.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
        <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-lg font-semibold">
            {copy('Operational location access unavailable')}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {copy('This account has no authorized operational location.')}
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

  const requestPasswordResetLink = async () => {
    if (resetLinkState.kind === 'pending') return;
    setResetLinkState({ kind: 'pending' });
    try {
      await passwordChange.requestResetLink();
      setResetLinkState({ kind: 'sent' });
    } catch (error) {
      setResetLinkState({
        kind: 'failed',
        reason: error instanceof PasswordChangeUnavailableError ? 'unavailable' : 'failed',
      });
    }
  };

  const openAccountDialog = () => {
    setResetLinkState({ kind: 'idle' });
    setAccountDialogOpen(true);
  };

  const branchLabel =
    selectedLocation?.name ??
    copy(operationalAccessQuery.isLoading ? 'Loading branch' : 'Choose branch');

  return (
    <div className="operational-shell flex h-screen w-full min-w-0 overflow-hidden bg-[var(--color-background)]">
      <aside className="operational-shell__sidebar hidden min-h-0 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-[1px_0_0_var(--color-border)] md:flex md:w-[232px] lg:w-[280px]">
        <div className="flex min-h-16 items-center gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
            {bootstrap.branding.logoUrl ? (
              <img
                src={bootstrap.branding.logoUrl}
                alt={`${bootstrap.branding.productName} logo`}
                className="size-full object-contain p-1"
              />
            ) : (
              <Building2 className="size-[18px]" strokeWidth={2.2} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
              {bootstrap.branding.productName}
            </p>
            <p className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
              {brandSubtitle}
            </p>
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

        <div className="mt-auto border-t border-[var(--color-border)]">
          <div className="px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <DAvatar
                alt=""
                name={session.identity.displayName}
                fallback={
                  userInitials ?? <UserRound className="size-4" aria-label={copy('Account')} />
                }
                size="sm"
                className="shrink-0 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-5 text-[var(--color-text)]">
                  {session.identity.displayName}
                </span>
                <span className="block truncate text-xs leading-4 text-[var(--color-text-muted)]">
                  {primaryRole?.name ?? usernameLabel ?? copy('Account')}
                </span>
              </span>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] px-3 py-2">
            <DButton
              variant="ghost"
              type="button"
              leftIcon={<LogOut className="size-4 shrink-0" />}
              loading={isLoggingOut}
              onClick={() => void handleLogout()}
              className="flex h-9 w-full items-center justify-start gap-2.5 px-3 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
            >
              {copy('Logout')}
            </DButton>
          </div>
        </div>
      </aside>

      <main className="operational-shell__main flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden">
        <header className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 shadow-[0_1px_0_var(--color-border)] md:px-6 lg:px-8">
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
                    <Menu className="size-[18px]" />
                  </DButton>
                )}
              >
                <div className="border-b border-[var(--color-border)] p-3">
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
                  ? 'bg-[var(--color-accent-coral)]/45'
                  : 'bg-[var(--color-accent-mint)]/55'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" /> {label(connectivity.state)}
            </span>
            <span className="operational-shell__header-date hidden text-xs text-[var(--color-text-muted)] md:inline">
              {formatCurrentDate(session.preferences.locale)}
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            <OperationalNotificationBell />
            <button
              type="button"
              onClick={openAccountDialog}
              aria-label={copy('Open account information')}
              aria-haspopup="dialog"
              aria-expanded={isAccountDialogOpen}
              className="operational-shell__account-trigger flex h-10 min-w-0 items-center gap-2 rounded-[var(--radius-control)] px-1.5 transition-colors duration-150 hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25"
            >
              <DAvatar
                alt=""
                name={session.identity.displayName}
                fallback={
                  userInitials ?? <UserRound className="size-4" aria-label={copy('Account')} />
                }
                size="sm"
                className="shrink-0 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]"
              />
              <span className="operational-shell__account-name min-w-0 max-w-[40vw] truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
                {session.identity.displayName}
              </span>
              <ChevronDown className="size-4 shrink-0 text-[var(--color-text-muted)]" />
            </button>
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
        className="w-full max-w-md rounded-t-[var(--radius-panel)] bg-[var(--color-surface)] shadow-2xl sm:rounded-[var(--radius-panel)]"
      >
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
            {copy('Branch')}
          </p>
          <h2 className="mt-1 text-lg font-bold">{copy('Choose active branch')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy('Select the location used for your active operation.')}
          </p>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto p-3">
          {operationalAccessQuery.isLoading ? (
            <p className="p-3 text-sm text-[var(--color-text-muted)]">
              {copy('Loading branches...')}
            </p>
          ) : locations.length === 0 ? (
            <div className="p-3 text-sm text-[var(--color-text-muted)]">
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
                    className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] ${
                      isSelected
                        ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                        : 'hover:bg-[var(--color-surface-muted)]'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <MapPin className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {location.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">
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
        <div className="border-t border-[var(--color-border)] px-5 py-3 text-right">
          <DButton variant="secondary" onClick={closeBranchPicker}>
            {copy('Close')}
          </DButton>
        </div>
      </DDialog>

      <DDialog
        open={isAccountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
        title={copy('Account')}
        description={copy('Operational account information for the active session.')}
        ariaLabel={copy('Account information')}
        closeOnEscape
        closeOnOverlay
        className="w-full max-w-md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DButton
              variant="ghost"
              leftIcon={<LogOut className="size-4" />}
              loading={isLoggingOut}
              onClick={() => void handleLogout()}
              className="text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
            >
              {copy('Logout')}
            </DButton>
            <DButton variant="secondary" onClick={() => setAccountDialogOpen(false)}>
              {copy('Close')}
            </DButton>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <DAvatar
              alt=""
              name={session.identity.displayName}
              fallback={
                userInitials ?? <UserRound className="size-5" aria-label={copy('Account')} />
              }
              size="lg"
              className="shrink-0 bg-[var(--color-brand)]/10 text-sm font-bold text-[var(--color-brand)]"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--color-text)]">
                {session.identity.displayName}
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">
                {headerIdentityContext}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-[var(--color-border)] rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/35">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-[var(--color-text-muted)]">{copy('Active branch')}</dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold">{branchLabel}</span>
                {locations.length > 1 ? (
                  <DButton
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => {
                      setAccountDialogOpen(false);
                      openBranchPicker();
                    }}
                  >
                    {copy('Switch branch')}
                  </DButton>
                ) : null}
              </dd>
            </div>
            {primaryRole ? (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                <dt className="text-xs text-[var(--color-text-muted)]">{copy('Role')}</dt>
                <dd className="truncate text-sm font-medium">{primaryRole.name}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <dt className="text-xs text-[var(--color-text-muted)]">{copy('App version')}</dt>
              <dd className="font-mono text-xs text-[var(--color-text-muted)]">
                {version.version}
              </dd>
            </div>
          </dl>

          <section className="rounded-[var(--radius-control)] border border-[var(--color-border)] p-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <KeyRound className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{copy('Request password change')}</p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">
                  {copy(
                    'A link to set a new password will be sent to the WhatsApp number registered on your account.',
                  )}
                </p>
              </div>
            </div>
            {resetLinkState.kind === 'sent' ? (
              <div
                className="operational-view-enter mt-3 flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-success)]/10 px-3 py-2 text-xs font-semibold text-[var(--color-success)]"
                aria-live="polite"
              >
                <MessageCircle className="size-4 shrink-0" aria-hidden="true" />
                {copy('Link sent to your WhatsApp.')}
              </div>
            ) : (
              <>
                {resetLinkState.kind === 'failed' ? (
                  <DAlert
                    variant={resetLinkState.reason === 'unavailable' ? 'warning' : 'danger'}
                    role="alert"
                    className="mt-3"
                  >
                    {copy(
                      resetLinkState.reason === 'unavailable'
                        ? 'Password change is not available yet. Contact your administrator.'
                        : 'The request could not be sent. Try again.',
                    )}
                  </DAlert>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <DButton
                    size="sm"
                    variant="outline"
                    loading={resetLinkState.kind === 'pending'}
                    onClick={() => void requestPasswordResetLink()}
                  >
                    {copy('Send reset link via WhatsApp')}
                  </DButton>
                </div>
              </>
            )}
          </section>
        </div>
      </DDialog>
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
      className="flex min-w-0 w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 enabled:hover:border-[var(--color-brand)]/30 enabled:hover:bg-[var(--color-surface-muted)] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
    >
      <MapPin className="size-3.5 shrink-0 text-[var(--color-brand)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {copy('Active branch')}
        </span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-[var(--color-text)]">
          {branchLabel}
        </span>
      </span>
      {canChoose ? (
        <ChevronDown className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
      ) : null}
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
          <p className="px-3 pb-1 text-[12px] font-semibold text-[var(--color-text-muted)]">
            {section.label}
          </p>
          <div className="space-y-0.5 pl-3">
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  [
                    'flex h-9 items-center justify-start gap-2 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                      : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
                  ].join(' ')
                }
              >
                <Icon className="size-[18px] shrink-0" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
