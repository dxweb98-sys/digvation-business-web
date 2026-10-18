import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { DAlert, DButton, DInput, DSkeleton } from '@digvation/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  PortalRequestError,
  PortalWorkspaceUnavailableError,
  call,
  currentSession,
  isValidIndonesianPhone,
  loadBootstrap,
  localPhoneInput,
  logout as logoutRequest,
  requestOtp as requestOtpChallenge,
  verifyOtp as verifyOtpCode,
} from './member-portal-api';
import {
  AuthHero,
  BottomNav,
  HomeView,
  MemberHero,
  PointsView,
  ProfileView,
  TransactionsView,
  type HistoryState,
  type PointEntry,
  type PortalSummary,
  type PortalView,
  type TransactionEntry,
} from './member-portal-views';

type AuthState =
  | 'CHECKING_SESSION'
  | 'PHONE_VERIFICATION'
  | 'OTP_REQUESTED'
  | 'OTP_VERIFYING'
  | 'AUTHENTICATED'
  | 'SESSION_EXPIRED';

const PAGE_SIZE = 20;

function Surface({ children, label }: { children: ReactNode; label: string }) {
  return (
    <main className="portal-shell">
      <div className="portal-surface" aria-label={label}>
        {children}
      </div>
    </main>
  );
}

/** One paged history list. Every read is server-scoped to the session Member. */
function useHistory<T>(kind: 'points' | 'transactions', onExpired: () => void) {
  const [data, setData] = useState<{
    items: T[];
    hasMore: boolean;
    loadedOffset: number;
    error: boolean;
  }>({
    items: [],
    hasMore: false,
    loadedOffset: -1,
    error: false,
  });
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  });

  useEffect(() => {
    let active = true;
    call(`/${kind}?offset=${offset}&limit=${PAGE_SIZE}`)
      .then((page: { items: T[] }) => {
        if (!active) return;
        setData((current) => ({
          items: offset ? current.items.concat(page.items) : page.items,
          hasMore: page.items.length === PAGE_SIZE,
          loadedOffset: offset,
          error: false,
        }));
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (
          requestError instanceof PortalRequestError &&
          (requestError.status === 401 || requestError.status === 403)
        )
          expired.current();
        else setData((current) => ({ ...current, loadedOffset: offset, error: true }));
      });
    return () => {
      active = false;
    };
  }, [kind, offset, attempt]);

  const pending = data.loadedOffset !== offset && !data.error;
  const state: HistoryState<T> = {
    items: data.items,
    hasMore: data.hasMore,
    loading: pending && data.items.length === 0,
    loadingMore: pending && data.items.length > 0,
    error: data.error,
  };
  return {
    state,
    loadMore: () => setOffset(data.items.length),
    retry: () => {
      setData((current) => ({ ...current, error: false }));
      setAttempt((value) => value + 1);
    },
  };
}

/** Mounted only while signed in, so a previous Member's data never survives logout. */
function SignedInPortal({
  summary,
  logoUrl,
  onLogout,
  onExpired,
}: {
  summary: PortalSummary;
  logoUrl: string | undefined;
  onLogout: () => void;
  onExpired: () => void;
}) {
  const [view, setView] = useState<PortalView>('home');
  const points = useHistory<PointEntry>('points', onExpired);
  const transactions = useHistory<TransactionEntry>('transactions', onExpired);

  function change(next: PortalView) {
    setView(next);
    window.scrollTo?.({ top: 0 });
  }

  return (
    <Surface label="Portal member">
      <MemberHero summary={summary} logoUrl={logoUrl} compact={view !== 'home'} />
      <div className="content">
        {view === 'home' && (
          <HomeView
            points={points.state}
            transactions={transactions.state}
            goTo={change}
            retry={(kind) => (kind === 'points' ? points.retry() : transactions.retry())}
          />
        )}
        {view === 'points' && (
          <PointsView state={points.state} loadMore={points.loadMore} retry={points.retry} />
        )}
        {view === 'transactions' && (
          <TransactionsView
            state={transactions.state}
            loadMore={transactions.loadMore}
            retry={transactions.retry}
          />
        )}
        {view === 'profile' && <ProfileView summary={summary} onLogout={onLogout} />}
      </div>
      <BottomNav view={view} onChange={change} />
    </Surface>
  );
}

export function MemberPortalApp() {
  const [bootstrap, setBootstrap] = useState<DeploymentBootstrapConfig>();
  const [state, setState] = useState<AuthState>('CHECKING_SESSION');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [phone, setPhone] = useState('');
  const [portal, setPortal] = useState<PortalSummary>();
  const [entryMessage, setEntryMessage] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const sendingRef = useRef(false);
  const [cooldown, setCooldown] = useState(0);

  // A valid Member Portal session skips OTP; only the server decides whether it is still valid.
  useEffect(() => {
    let active = true;
    void loadBootstrap().then((config) => active && setBootstrap(config));
    currentSession().then(
      (summary: PortalSummary) => {
        if (!active) return;
        setPortal(summary);
        setState('AUTHENTICATED');
      },
      () => active && setState('PHONE_VERIFICATION'),
    );
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function requestOtp() {
    if (
      !isValidIndonesianPhone(phone) ||
      sendingRef.current ||
      cooldown > 0 ||
      (state !== 'PHONE_VERIFICATION' && state !== 'OTP_REQUESTED')
    )
      return;
    sendingRef.current = true;
    setEntryMessage('');
    setSendingOtp(true);
    try {
      const challengeResult = await requestOtpChallenge(phone);
      setCode('');
      setChallenge(challengeResult.challengeId);
      setCooldown(challengeResult.resendAfterSeconds);
      setState('OTP_REQUESTED');
    } catch (requestError) {
      setEntryMessage(
        requestError instanceof PortalWorkspaceUnavailableError
          ? 'Portal member belum tersedia di alamat ini. Silakan hubungi tempat Anda terdaftar sebagai member.'
          : requestError instanceof PortalRequestError && requestError.status === 503
            ? 'Kode OTP belum dapat dikirim. Silakan coba lagi.'
            : requestError instanceof PortalRequestError && requestError.status === 422
              ? 'Nomor telepon tidak valid. Periksa kembali nomor Anda.'
              : requestError instanceof PortalRequestError
                ? 'Permintaan belum dapat diproses. Silakan coba lagi.'
                : 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
      );
    } finally {
      sendingRef.current = false;
      setSendingOtp(false);
    }
  }
  async function verifyOtp() {
    if (state !== 'OTP_REQUESTED' || code.length !== 6) return;
    setEntryMessage('');
    setState('OTP_VERIFYING');
    let verified = false;
    try {
      await verifyOtpCode(challenge, code);
      verified = true;
      const summary = await call('/summary');
      setPortal(summary);
      setState('AUTHENTICATED');
    } catch {
      setState(verified ? 'PHONE_VERIFICATION' : 'OTP_REQUESTED');
      if (verified) {
        setChallenge('');
        setCode('');
      }
      setEntryMessage(
        verified
          ? 'Portal belum dapat dibuka. Silakan minta kode verifikasi baru.'
          : 'Kode belum sesuai atau sudah tidak berlaku. Periksa kembali lalu coba lagi.',
      );
    }
  }
  function returnToPhoneVerification() {
    setPortal(undefined);
    setChallenge('');
    setCode('');
    setEntryMessage('');
    setCooldown(0);
    setState('PHONE_VERIFICATION');
  }
  async function logout() {
    try {
      await logoutRequest();
    } finally {
      returnToPhoneVerification();
    }
  }

  const branding = bootstrap?.branding;
  const brandName = branding?.companyName ?? branding?.productName ?? 'Digvation';
  const frame = (content: ReactNode) =>
    bootstrap ? (
      <DeploymentBootstrapProvider config={bootstrap}>{content}</DeploymentBootstrapProvider>
    ) : (
      <>{content}</>
    );

  if (state === 'CHECKING_SESSION')
    return frame(
      <Surface label="Memuat portal member">
        <div className="hero hero--loading" />
        <div className="content" role="status" aria-live="polite">
          <span className="sr-only">Memuat…</span>
          <DSkeleton height={72} count={3} />
        </div>
      </Surface>,
    );

  if (state === 'SESSION_EXPIRED')
    return frame(
      <Surface label="Sesi berakhir">
        <AuthHero
          brandName={brandName}
          logoUrl={branding?.logoUrl}
          title="Sesi Anda telah berakhir"
          lead="Untuk menjaga keamanan akun, verifikasi kembali nomor telepon Anda."
        />
        <div className="content">
          <DButton fullWidth size="lg" onClick={returnToPhoneVerification}>
            Kembali ke awal
          </DButton>
        </div>
      </Surface>,
    );

  if (state === 'AUTHENTICATED' && portal)
    return frame(
      <SignedInPortal
        summary={portal}
        logoUrl={branding?.logoUrl}
        onLogout={() => void logout()}
        onExpired={() => setState('SESSION_EXPIRED')}
      />,
    );

  return frame(
    <Surface label="Masuk ke portal member">
      {state === 'PHONE_VERIFICATION' ? (
        <>
          <AuthHero
            brandName={brandName}
            logoUrl={branding?.logoUrl}
            title="Selamat datang"
            lead="Verifikasi nomor Anda untuk melihat poin dan riwayat transaksi."
          />
          <section className="auth-step" aria-labelledby="hero-title">
            <DInput
              id="phone"
              label="Nomor WhatsApp / Telepon"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              prefix="+62"
              placeholder="812 3456 7890"
              value={phone}
              onChange={(value) => setPhone(localPhoneInput(value))}
              hint="Jika nomor terdaftar sebagai member, kode OTP akan dikirim melalui WhatsApp."
            />
            {entryMessage && <DAlert variant="danger">{entryMessage}</DAlert>}
            <DButton
              fullWidth
              size="lg"
              loading={sendingOtp}
              disabled={!isValidIndonesianPhone(phone)}
              onClick={() => void requestOtp()}
            >
              {sendingOtp ? 'Mengirim kode…' : 'Kirim kode OTP'}
            </DButton>
            <p className="auth-note">
              Poin dan riwayat transaksi hanya tampil setelah verifikasi OTP.
            </p>
          </section>
        </>
      ) : (
        <>
          <AuthHero
            brandName={brandName}
            logoUrl={branding?.logoUrl}
            title="Masukkan kode OTP"
            lead="Kode telah dikirim melalui WhatsApp ke nomor yang terdaftar."
          />
          <section className="auth-step" aria-labelledby="hero-title">
            <DInput
              id="otp"
              label="Kode OTP"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              hint="Berlaku beberapa menit. Jangan berikan kode kepada siapa pun."
            />
            {entryMessage && <DAlert variant="danger">{entryMessage}</DAlert>}
            <DButton
              fullWidth
              size="lg"
              loading={state === 'OTP_VERIFYING'}
              disabled={state === 'OTP_VERIFYING' || code.length !== 6}
              onClick={() => void verifyOtp()}
            >
              {state === 'OTP_VERIFYING' ? 'Memverifikasi…' : 'Verifikasi'}
            </DButton>
            <div className="otp-actions">
              <DButton
                variant="ghost"
                size="sm"
                disabled={sendingOtp || cooldown > 0}
                onClick={() => void requestOtp()}
              >
                {sendingOtp
                  ? 'Mengirim ulang kode…'
                  : cooldown > 0
                    ? `Kirim ulang kode dalam ${cooldown} detik`
                    : 'Kirim ulang kode'}
              </DButton>
              <DButton variant="ghost" size="sm" onClick={returnToPhoneVerification}>
                Ubah nomor
              </DButton>
            </div>
          </section>
        </>
      )}
    </Surface>,
  );
}
