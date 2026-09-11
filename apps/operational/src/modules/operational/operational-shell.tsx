import { ApiClient } from '@digvation/business-api';
import { useAuth } from '@digvation/business-auth';
import { useConnectivity, useRuntime } from '@digvation/business-runtime';
import { DAvatar, DButton, DDialog, DDropdown, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Check,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';

import { getAppVersion } from '../../app/version/app-version';
import { OperationalAccessApi, operationalAccessKeys } from './operational-access-api';
import type { OperationalNavigationSection } from './operational-navigation';
import { useOperationalSession } from './operational-session-provider';

function formatCurrentDate(locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function identityInitials(displayName: string, initials?: string): string | null {
  if (initials?.trim()) return initials.trim().slice(0, 2).toUpperCase();
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
  const runtime = useRuntime();
  const connectivity = useConnectivity();
  const { session, authPort, logout } = useAuth();
  const { showToast } = useToast();
  const [isLoggingOut, setLoggingOut] = useState(false);
  const [isAccountDialogOpen, setAccountDialogOpen] = useState(false);
  const [isRequestingPasswordChange, setRequestingPasswordChange] = useState(false);
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
          baseUrl: runtime.apiBaseUrl,
          ...(authPort.getAccessToken
            ? { getAccessToken: authPort.getAccessToken.bind(authPort) }
            : {}),
        }),
      ),
    [authPort, runtime],
  );
  const operationalAccessQuery = useQuery({
    queryKey: operationalAccessKeys.context(),
    queryFn: ({ signal }) => operationalAccess.context(signal),
  });
  const locations = useMemo(
    () => operationalAccessQuery.data?.locations ?? [],
    [operationalAccessQuery.data],
  );
  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? null;
  const brandSubtitle =
    runtime.branding.businessName ?? runtime.branding.companyName ?? runtime.workspace;
  const userInitials = identityInitials(
    session.identity.displayName,
    session.identity.initials,
  );

  useEffect(() => {
    if (locations.length === 1 && selectedLocationId !== locations[0]!.id)
      selectLocation(locations[0]!.id);
    else if (
      selectedLocationId &&
      !locations.some((location) => location.id === selectedLocationId)
    )
      selectLocation(null);
  }, [locations, selectLocation, selectedLocationId]);

  if (operationalAccessQuery.isSuccess && locations.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6 text-center">
        <section className="max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-lg font-semibold">Akses lokasi operasional tidak tersedia</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Akun ini belum memiliki lokasi operasional yang diizinkan.
          </p>
          <DButton className="mt-5" variant="secondary" onClick={() => void logout()}>
            Keluar
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
        'Changing Branch leaves the current Sale OPEN and returns you to a new Sale. Continue?',
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
        title: 'Logout gagal',
        description: 'Sesi belum dapat diakhiri. Silakan coba lagi.',
        variant: 'danger',
      });
    }
  };

  const requestPasswordChange = async () => {
    if (isRequestingPasswordChange) return;
    const email = session.identity.email;
    if (!email) {
      showToast({
        title: 'Email tidak tersedia',
        description: 'Hubungi administrator untuk meminta perubahan kata sandi.',
        variant: 'warning',
      });
      return;
    }

    setRequestingPasswordChange(true);
    try {
      await authPort.requestPasswordChange({ email });
      showToast({
        title: 'Permintaan diterima',
        description: 'Instruksi perubahan kata sandi akan dikirim ke email akun Anda.',
        variant: 'success',
      });
    } catch {
      showToast({
        title: 'Permintaan belum dapat diproses',
        description: 'Silakan coba lagi atau hubungi administrator.',
        variant: 'danger',
      });
    } finally {
      setRequestingPasswordChange(false);
    }
  };

  const branchLabel =
    selectedLocation?.name ??
    (operationalAccessQuery.isLoading ? 'Loading branch' : 'Choose branch');

  return (
    <div className="operational-shell flex h-screen w-full min-w-0 overflow-hidden bg-[var(--color-background)]">
      <aside className="operational-shell__sidebar hidden min-h-0 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] shadow-[1px_0_0_var(--color-border)] md:flex md:w-[232px] lg:w-[280px]">
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
                {...(session.identity.avatarUrl ? { src: session.identity.avatarUrl } : {})}
                alt=""
                name={session.identity.displayName}
                fallback={
                  userInitials ?? <UserRound className="size-4" aria-label="User account" />
                }
                size="sm"
                className="shrink-0 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-5 text-[var(--color-text)]">
                  {session.identity.displayName}
                </span>
                <span className="block truncate text-xs leading-4 text-[var(--color-text-muted)]">
                  v{version.version} · {version.revision}
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
              Logout
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
                  <DButton variant="ghost" size="icon" aria-label="Open navigation">
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
              <span className="size-1.5 rounded-full bg-current" /> {connectivity.state}
            </span>
            <span className="operational-shell__header-date hidden text-xs text-[var(--color-text-muted)] md:inline">
              {formatCurrentDate(runtime.locale)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAccountDialogOpen(true)}
            aria-label="Open account information"
            aria-haspopup="dialog"
            aria-expanded={isAccountDialogOpen}
            className="flex h-[42px] min-w-0 max-w-[min(50vw,340px)] items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 px-2.5 text-left transition-colors duration-150 hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/20"
          >
            <span className="hidden min-w-0 flex-1 flex-col justify-center sm:flex">
              <span className="truncate text-sm font-semibold leading-5 text-[var(--color-text)]">
                {session.identity.displayName}
              </span>
              <span className="truncate text-xs leading-4 text-[var(--color-text-muted)]">
                {session.identity.email ?? runtime.deploymentProfile}
              </span>
            </span>
            <DAvatar
              {...(session.identity.avatarUrl ? { src: session.identity.avatarUrl } : {})}
              alt=""
              name={session.identity.displayName}
              fallback={
                userInitials ?? <UserRound className="size-4" aria-label="User account" />
              }
              size="sm"
              className="shrink-0 bg-[var(--color-brand)]/10 text-xs font-bold text-[var(--color-brand)]"
            />
          </button>
        </header>

        <div className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </main>

      <DDialog
        open={isBranchPickerOpen}
        onClose={closeBranchPicker}
        ariaLabel="Choose active branch"
        closeOnEscape
        closeOnOverlay
        showClose={false}
        noPadding
        className="w-full max-w-md rounded-t-[var(--radius-panel)] bg-[var(--color-surface)] shadow-2xl sm:rounded-[var(--radius-panel)]"
      >
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand)]">
            Workspace
          </p>
          <h2 className="mt-1 text-lg font-bold">Choose active branch</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Pilih lokasi yang digunakan untuk operasi aktif Anda.
          </p>
        </div>
        <div className="max-h-[min(420px,60vh)] overflow-y-auto p-3">
          {operationalAccessQuery.isLoading ? (
            <p className="p-3 text-sm text-[var(--color-text-muted)]">Loading branches...</p>
          ) : locations.length === 0 ? (
            <div className="p-3 text-sm text-[var(--color-text-muted)]">
              No active branches are available for this workspace.
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
                        <span className="block truncate text-sm font-semibold">{location.name}</span>
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
            Close
          </DButton>
        </div>
      </DDialog>

      <DDialog
        open={isAccountDialogOpen}
        onClose={() => setAccountDialogOpen(false)}
        title="Account"
        description="Informasi akun operasional yang sedang aktif."
        ariaLabel="Account information"
        closeOnEscape
        closeOnOverlay
        className="w-full max-w-md rounded-[var(--radius-panel)] bg-[var(--color-surface)]"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DButton variant="secondary" onClick={() => setAccountDialogOpen(false)}>
              Close
            </DButton>
            <DButton
              loading={isRequestingPasswordChange}
              onClick={() => void requestPasswordChange()}
            >
              Request change password
            </DButton>
          </div>
        }
      >
        <div>
          <div className="flex min-w-0 items-center gap-3.5">
            <DAvatar
              {...(session.identity.avatarUrl ? { src: session.identity.avatarUrl } : {})}
              alt=""
              name={session.identity.displayName}
              fallback={
                userInitials ?? <UserRound className="size-5" aria-label="User account" />
              }
              size="lg"
              className="shrink-0 bg-[var(--color-brand)]/10 text-sm font-bold text-[var(--color-brand)]"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--color-text)]">
                {session.identity.displayName}
              </p>
              <p className="mt-0.5 truncate text-sm text-[var(--color-text-muted)]">
                {session.identity.email ?? session.identity.userId}
              </p>
            </div>
          </div>
          {selectedLocation ? (
            <div className="mt-5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Active branch
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                {selectedLocation.name}
              </p>
            </div>
          ) : null}
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canChoose}
      aria-label={`Active branch ${branchLabel}`}
      className="flex min-w-0 w-full items-center gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 px-3 py-2.5 text-left transition-[background-color,border-color,box-shadow] duration-150 enabled:hover:border-[var(--color-brand)]/30 enabled:hover:bg-[var(--color-surface-muted)] disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
    >
      <MapPin className="size-3.5 shrink-0 text-[var(--color-brand)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          Active branch
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
