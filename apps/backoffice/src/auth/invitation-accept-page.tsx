import { ApiClient, ApiError } from '@digvation/business-api';
import { useDeploymentBootstrap } from '@digvation/business-runtime';
import { DButton, DInput } from '@digvation/ui';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PublicAuthApi, type InvitationLinkPreview, type InvitationLinkState } from './public-auth-api';
import { readSecureTokenFromHash, removeSecureTokenFromAddress } from './public-auth-flow';
import { PublicAuthShell } from './public-auth-shell';

type PageState =
  | { kind: 'loading' }
  | { kind: 'resolved'; preview: InvitationLinkPreview }
  | { kind: 'success' }
  | { kind: 'invalid' };

export function InvitationAcceptPage() {
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
    void api.resolveInvitation(token).then(
      (preview) => {
        if (active) setPage({ kind: 'resolved', preview });
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
      <PublicAuthShell title="Aktivasi akun" description="Memeriksa tautan undangan Anda.">
        <p className="text-sm text-[var(--color-text-muted)]">Memuat undangan...</p>
      </PublicAuthShell>
    );
  }

  if (page.kind === 'invalid') return <InvitationState state="INVALID" />;
  if (page.kind === 'success') {
    return (
      <PublicAuthShell
        title="Akun berhasil diaktifkan"
        description="Kata sandi Anda sudah dibuat. Silakan masuk menggunakan akun Anda."
        showLoginLink
      >
        <p className="text-sm text-[var(--color-success)]">Akun Anda sekarang aktif.</p>
      </PublicAuthShell>
    );
  }

  if (page.preview.invitationState !== 'VALID') {
    return <InvitationState state={page.preview.invitationState} />;
  }

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
      await api.acceptInvitation(token, password);
      setPassword('');
      setConfirmation('');
      setPage({ kind: 'success' });
    } catch (error) {
      const state = invitationStateFromError(error);
      if (state) setPage({ kind: 'resolved', preview: { invitationState: state } });
      else setFormError('Akun belum dapat diaktifkan. Silakan coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicAuthShell
      title="Aktifkan akun"
      description={`Anda diundang bergabung ke ${page.preview.businessName ?? 'Digvation Business'}. Buat kata sandi untuk mengaktifkan akun.`}
    >
      <dl className="mb-6 grid gap-3 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-4 text-sm">
        <SafeDetail label="Nama" value={page.preview.displayName} />
        {page.preview.username ? <SafeDetail label="Username" value={page.preview.username} /> : null}
        <SafeDetail label="Nomor WhatsApp" value={page.preview.maskedPhone} />
      </dl>

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
          Aktifkan akun
        </DButton>
      </form>
    </PublicAuthShell>
  );
}

function SafeDetail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function InvitationState({ state }: { state: InvitationLinkState }) {
  const content: Record<InvitationLinkState, { title: string; message: string }> = {
    VALID: { title: 'Aktivasi akun', message: '' },
    INVALID: { title: 'Tautan tidak valid', message: 'Tautan undangan tidak valid.' },
    EXPIRED: { title: 'Tautan kedaluwarsa', message: 'Tautan undangan sudah kedaluwarsa.' },
    REVOKED: { title: 'Undangan dibatalkan', message: 'Undangan ini sudah dibatalkan.' },
    USED: { title: 'Undangan sudah digunakan', message: 'Undangan ini sudah digunakan.' },
  };
  const selected = content[state];
  return (
    <PublicAuthShell title={selected.title} description={selected.message} showLoginLink>
      <p className="text-sm text-[var(--color-text-muted)]">
        Jika Anda memerlukan bantuan, hubungi pemilik bisnis yang mengundang Anda.
      </p>
    </PublicAuthShell>
  );
}

function invitationStateFromError(error: unknown): Exclude<InvitationLinkState, 'VALID'> | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === 'INVITATION_EXPIRED') return 'EXPIRED';
  if (error.code === 'INVITATION_REVOKED') return 'REVOKED';
  if (error.code === 'INVITATION_USED') return 'USED';
  if (error.code === 'INVITATION_INVALID') return 'INVALID';
  return null;
}
