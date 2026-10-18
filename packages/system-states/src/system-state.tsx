import { DButton } from '@digvation/ui';
import type { ReactNode } from 'react';

export type SystemStateKind =
  | 'not-found'
  | 'forbidden'
  | 'offline'
  | 'service-unavailable'
  | 'application-error'
  | 'no-data'
  | 'no-results';

export type SystemStateVariant = 'page' | 'content' | 'compact';

const content: Record<SystemStateKind, { title: string; description: string }> = {
  'not-found': {
    title: 'Halaman tidak ditemukan',
    description: 'Halaman yang Anda buka tidak tersedia atau sudah dipindahkan.',
  },
  forbidden: {
    title: 'Anda tidak memiliki akses',
    description: 'Akun Anda tidak memiliki izin untuk membuka halaman ini.',
  },
  offline: {
    title: 'Koneksi terputus',
    description: 'Periksa koneksi internet Anda lalu coba lagi.',
  },
  'service-unavailable': {
    title: 'Layanan sedang tidak tersedia',
    description: 'Sistem sedang mengalami gangguan sementara. Silakan coba beberapa saat lagi.',
  },
  'application-error': {
    title: 'Terjadi kesalahan',
    description: 'Terjadi kendala saat memuat halaman ini.',
  },
  'no-data': { title: 'Belum ada data', description: '' },
  'no-results': {
    title: 'Tidak ada hasil',
    description: 'Coba ubah kata kunci atau filter Anda.',
  },
};

interface SystemStateProps {
  state: SystemStateKind;
  action?: ReactNode;
  description?: string;
  variant?: SystemStateVariant;
}

export function SystemState({ state, action, description, variant = 'content' }: SystemStateProps) {
  const stateContent = content[state];
  const resolvedDescription = description ?? stateContent.description;
  const compact = variant === 'compact';

  return (
    <section
      className={`mx-auto flex w-full flex-col items-center text-center ${
        compact ? 'max-w-xs gap-2 py-4' : 'max-w-xl gap-4 py-10 sm:py-14'
      }`}
      aria-labelledby={`system-state-${state}`}
    >
      <span
        aria-hidden="true"
        className={`rounded-full bg-[var(--color-accent-mint)]/55 ${compact ? 'size-2' : 'size-3'}`}
      />
      <div className={compact ? 'space-y-1' : 'space-y-2'}>
        <h1
          id={`system-state-${state}`}
          className={
            compact ? 'text-sm font-semibold' : 'text-2xl font-bold tracking-tight sm:text-3xl'
          }
        >
          {stateContent.title}
        </h1>
        {resolvedDescription ? (
          <p
            className={
              compact
                ? 'text-xs text-[var(--color-text-muted)]'
                : 'text-sm leading-6 text-[var(--color-text-muted)]'
            }
          >
            {resolvedDescription}
          </p>
        ) : null}
      </div>
      {action ? <div className={compact ? 'pt-1' : 'pt-2'}>{action}</div> : null}
    </section>
  );
}

export function SystemStatePage({ variant = 'page', ...props }: SystemStateProps) {
  const pageClass =
    variant === 'page' ? 'min-h-screen px-6' : 'min-h-full min-w-0 px-6 sm:px-10 lg:px-14';
  return (
    <main className={`flex ${pageClass} items-center justify-center bg-[var(--color-background)]`}>
      <SystemState {...props} variant={variant} />
    </main>
  );
}

interface ConnectionStateBoundaryProps {
  isOnline: boolean;
  children: ReactNode;
}

export function ConnectionStateBoundary({ isOnline, children }: ConnectionStateBoundaryProps) {
  if (isOnline) return <>{children}</>;

  return (
    <SystemStatePage
      state="offline"
      action={
        <DButton variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Coba lagi
        </DButton>
      }
    />
  );
}
