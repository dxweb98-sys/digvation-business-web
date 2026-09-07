import { DButton, DInput, useToast } from '@digvation/ui';
import { ReceiptText } from 'lucide-react';
import { useRef, useState, type FormEvent, type TransitionEvent } from 'react';

import type { AuthPort, AuthSession } from '@digvation/pos-auth';

interface CashierLoginPageProps {
  authPort: AuthPort;
  onAuthenticated: (session: AuthSession) => void;
}

function loginFailureMessage(error: unknown) {
  if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
    return 'Periksa kembali ID pengguna dan kata sandi Anda.';
  }
  return 'Login belum dapat diproses. Silakan coba lagi.';
}

/** App-owned login composition using the canonical shared field, button, and toast primitives. */
export function CashierLoginPage({ authPort, onAuthenticated }: CashierLoginPageProps) {
  const { showToast } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [isLeaving, setLeaving] = useState(false);
  const authenticatedSession = useRef<AuthSession | null>(null);
  const hasCompletedTransition = useRef(false);

  const completeTransition = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return;
    if (!isLeaving || hasCompletedTransition.current || !authenticatedSession.current) return;
    hasCompletedTransition.current = true;
    onAuthenticated(authenticatedSession.current);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || isLeaving) return;

    if (!identifier.trim() || !password) {
      showToast({
        title: 'Data login belum lengkap',
        description: 'Masukkan ID pengguna dan kata sandi untuk melanjutkan.',
        variant: 'danger',
      });
      return;
    }

    setSubmitting(true);
    try {
      const session = await authPort.login({ identifier: identifier.trim(), password });
      authenticatedSession.current = session;
      showToast({
        title: 'Login berhasil',
        description: `Selamat datang, ${session.identity.displayName}.`,
        variant: 'success',
      });
      setLeaving(true);
    } catch (error) {
      setSubmitting(false);
      showToast({
        title: 'Login gagal',
        description: loginFailureMessage(error),
        variant: 'danger',
      });
    }
  };

  return (
    <main
      className={`grid min-h-screen place-items-center overflow-hidden bg-[var(--color-background)] px-4 py-8 transition-[opacity,transform] duration-200 ease-out sm:px-6 ${
        isLeaving ? 'pointer-events-none -translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
      onTransitionEnd={completeTransition}
    >
      <div className="pointer-events-none absolute left-[12%] top-[18%] size-64 rounded-full bg-[var(--color-brand)]/[0.035] blur-3xl" />
      <div className="pointer-events-none absolute bottom-[12%] right-[14%] size-56 rounded-full bg-[var(--color-accent-lavender)]/25 blur-3xl" />

      <section className="relative w-full max-w-sm">
        <header className="mb-8 text-center">
          <div className="relative mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--color-brand)] text-white shadow-lg shadow-[var(--color-brand)]/20">
            <ReceiptText className="size-6" aria-hidden="true" />
            <span className="absolute inset-0 -z-10 rounded-2xl bg-[var(--color-brand)]/20 animate-ping [animation-duration:2s]" />
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
            Digvation POS
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            Masuk untuk membuka ruang kerja kasir.
          </p>
        </header>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)]">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">Masuk</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Gunakan akun Anda untuk memulai transaksi.
          </p>

          <form autoComplete="on" className="mt-6 space-y-4" onSubmit={submit}>
            <DInput
              id="cashier-identifier"
              name="username"
              label="ID pengguna"
              value={identifier}
              disabled={isSubmitting}
              onChange={setIdentifier}
              placeholder="Username atau email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            <DInput
              id="cashier-password"
              name="password"
              label="Kata sandi"
              type="password"
              value={password}
              disabled={isSubmitting}
              onChange={setPassword}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
            />
            <DButton type="submit" fullWidth loading={isSubmitting} className="mt-2">
              {isLeaving ? 'Membuka POS...' : isSubmitting ? 'Memverifikasi...' : 'Masuk'}
            </DButton>
          </form>
        </div>
      </section>
    </main>
  );
}
