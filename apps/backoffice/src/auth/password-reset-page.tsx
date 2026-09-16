import { ApiClient, ApiError } from '@digvation/business-api';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DButton, DInput } from '@digvation/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PublicAuthApi, type PasswordResetLinkState } from './public-auth-api';
import { readSecureTokenFromHash, removeSecureTokenFromAddress } from './public-auth-flow';
import { PublicAuthShell } from './public-auth-shell';

type PageState =
  | { kind: 'loading' }
  | { kind: 'resolved'; state: PasswordResetLinkState }
  | { kind: 'success' }
  | { kind: 'invalid' };

export function PasswordResetPage() {
  const bootstrap = useDeploymentBootstrap();
  const api = useMemo(
    () => new PublicAuthApi(new ApiClient({ baseUrl: bootstrap.apiBaseUrl })),
    [bootstrap.apiBaseUrl],
  );
  const [token] = useState(() => readSecureTokenFromHash(window.location.hash));
  const [page, setPage] = useState<PageState>(() => (token ? { kind: 'loading' } : { kind: 'invalid' }));
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    removeSecureTokenFromAddress();
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api.resolvePasswordReset(token).then(
      (resolved) => {
        if (active) setPage({ kind: 'resolved', state: resolved.resetState });
      },
      () => {
        if (active) setPage({ kind: 'invalid' });
      },
    );
    return () => {
      active = false;
    };
  }, [api, token]);

  if (page.kind === 'loading') {
    return (
      <PublicAuthShell title="Pulihkan kata sandi" description="Memeriksa tautan pemulihan Anda.">
        <p className="text-sm text-[var(--color-text-muted)]">Memuat...</p>
      </PublicAuthShell>
    );
  }
  if (page.kind === 'invalid') return <ResetState state="INVALID" />;
  if (page.kind === 'success') {
    return (
      <PublicAuthShell
        title="Kata sandi berhasil diperbarui"
        description="Kata sandi berhasil diperbarui. Semua sesi sebelumnya telah diakhiri."
        showLoginLink
      >
        <p className="text-sm text-[var(--color-success)]">Silakan masuk menggunakan kata sandi baru.</p>
      </PublicAuthShell>
    );
  }
  if (page.state !== 'VALID') return <ResetState state={page.state} />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || submitting) return;
    setFormError(null);
    if (password.length < 10 || password.length > 128) {
      setFormError('Kata sandi harus terdiri dari 10 sampai 128 karakter.');
      return;
    }
    if (password !== confirmation) {
      setFormError('Konfirmasi kata sandi tidak sama.');
      return;
    }

    setSubmitting(true);
    try {
      await api.completePasswordReset(token, password);
      setPassword('');
      setConfirmation('');
      setPage({ kind: 'success' });
    } catch (error) {
      const state = resetStateFromError(error);
      if (state) setPage({ kind: 'resolved', state });
      else setFormError('Kata sandi belum dapat diperbarui. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicAuthShell
      title="Buat kata sandi baru"
      description="Masukkan kata sandi baru untuk akun Anda. Anda akan diminta masuk kembali setelah proses selesai."
    >
      <form className="space-y-4" onSubmit={submit}>
        <DInput
          label="Password baru"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={submitting}
          placeholder="Minimal 10 karakter"
        />
        <DInput
          label="Konfirmasi password"
          type="password"
          value={confirmation}
          onChange={setConfirmation}
          autoComplete="new-password"
          disabled={submitting}
          placeholder="Ulangi password baru"
        />
        {formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger)]">
            {formError}
          </p>
        ) : null}
        <DButton type="submit" fullWidth loading={submitting} disabled={!password || !confirmation}>
          Simpan kata sandi baru
        </DButton>
      </form>
    </PublicAuthShell>
  );
}

function ResetState({ state }: { state: PasswordResetLinkState }) {
  const content: Record<PasswordResetLinkState, { title: string; message: string }> = {
    VALID: { title: 'Pulihkan kata sandi', message: '' },
    INVALID: { title: 'Tautan tidak valid', message: 'Tautan pemulihan tidak valid.' },
    EXPIRED: { title: 'Tautan kedaluwarsa', message: 'Tautan pemulihan sudah kedaluwarsa.' },
    USED: { title: 'Tautan sudah digunakan', message: 'Tautan pemulihan sudah digunakan.' },
  };
  const selected = content[state];
  return (
    <PublicAuthShell title={selected.title} description={selected.message} showLoginLink>
      <p className="text-sm text-[var(--color-text-muted)]">
        Minta tautan pemulihan baru dari halaman masuk jika masih diperlukan.
      </p>
    </PublicAuthShell>
  );
}

function resetStateFromError(error: unknown): Exclude<PasswordResetLinkState, 'VALID'> | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'PASSWORD_RESET_EXPIRED') return 'EXPIRED';
  if (error.code === 'PASSWORD_RESET_USED') return 'USED';
  if (error.code === 'PASSWORD_RESET_INVALID') return 'INVALID';
  return null;
}
