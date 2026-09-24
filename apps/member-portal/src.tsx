import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
const api = import.meta.env.VITE_RUNTIME_API_URL ?? '';
const handle = location.pathname.split('/').pop() ?? '';
async function call(path: string, init?: RequestInit) {
  const r = await fetch(`${api}/api/v1/member-portal${path}`, {
    credentials: 'include',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!r.ok) throw new Error('unavailable');
  return r.json();
}
const formatNumber = (value: string | number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatMoney = (value: string, currency = 'IDR') =>
  currency === 'IDR'
    ? `Rp${formatNumber(value)}`
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);
const formatDate = (value: string) => {
  const date = new Date(value);
  return `${new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)} · ${new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(':', '.')}`;
};
const displayReference = (value: string | null | undefined) =>
  !value || /^[0-9a-f-]{36}$/i.test(value) ? 'Transaksi' : value;
function localPhoneInput(raw: string) {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('62') ? digits.slice(2) : digits;
}
function submittedPhone(raw: string) {
  return `+62${localPhoneInput(raw).replace(/^0+/, '')}`;
}
function isValidIndonesianPhone(raw: string) {
  return /^\+62\d{8,13}$/.test(submittedPhone(raw));
}
function App() {
  const [entry, setEntry] = useState<any>();
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [phone, setPhone] = useState('');
  const [portal, setPortal] = useState<any>();
  const [tab, setTab] = useState<'points' | 'transactions'>('points');
  const [items, setItems] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [entryMessage, setEntryMessage] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState('');
  const [hasMore, setHasMore] = useState(true);
  useEffect(() => {
    call(`/entry/${handle}`)
      .then(setEntry)
      .catch(() => setError('Tautan member tidak tersedia.'));
  }, []);
  useEffect(() => {
    if (!portal) return;
    call(`/${tab}?offset=${offset}&limit=20`)
      .then((x) => {
        setItems((v) => (offset ? v.concat(x.items) : x.items));
        setHasMore(x.items.length === 20);
      })
      .catch(() => setError('Sesi telah berakhir.'));
  }, [portal, tab, offset]);
  async function requestOtp() {
    setEntryMessage('');
    try {
      const x = await call('/otp', {
        method: 'POST',
        body: JSON.stringify({ handle, phone: submittedPhone(phone) }),
      });
      setChallenge(x.challengeId ?? '');
    } catch {
      setEntryMessage('Kode belum dapat dikirim. Silakan coba beberapa saat lagi.');
    }
  }
  async function verifyOtp() {
    setEntryMessage('');
    try {
      await call('/verify', {
        method: 'POST',
        body: JSON.stringify({ handle, challengeId: challenge, code }),
      });
      setPortal(await call('/summary'));
    } catch {
      setEntryMessage(
        'Kode belum sesuai atau sudah tidak berlaku. Periksa kembali lalu coba lagi.',
      );
    }
  }
  if (error)
    return (
      <main className="portal-shell">
        <section className="state-card">
          <span className="state-icon" aria-hidden="true">
            !
          </span>
          <p className="eyebrow">Member Portal</p>
          <h1>
            {error === 'Sesi telah berakhir.'
              ? 'Sesi Anda telah berakhir'
              : 'Tautan member tidak tersedia'}
          </h1>
          <p>
            {error === 'Sesi telah berakhir.'
              ? 'Untuk menjaga keamanan akun, silakan buka kembali tautan member Anda dan verifikasi nomor telepon.'
              : 'Tautan ini mungkin sudah tidak aktif atau telah diperbarui. Silakan hubungi tempat Anda terdaftar sebagai member.'}
          </p>
          <button className="button primary" onClick={() => location.reload()}>
            Kembali ke awal
          </button>
        </section>
      </main>
    );
  if (!entry) return <main className="skeleton">Memuat…</main>;
  if (!portal)
    return (
      <main className="portal-shell">
        <section className="entry-screen" aria-labelledby="entry-title">
          <div className="identity">
            <b>D</b>
            <span>Member Portal</span>
          </div>
          <p className="eyebrow">Akses member</p>
          <h1 id="entry-title">Selamat datang</h1>
          <p className="lead">Verifikasi nomor Anda untuk melihat point dan riwayat transaksi.</p>
          <label className="phone-field" htmlFor="phone">
            <span className="round-icon">✓</span>
            <div className="phone-input-wrap">
              <span className="phone-label">Nomor WhatsApp / Telepon</span>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(localPhoneInput(event.target.value))}
                placeholder="812 3456 7890"
                aria-describedby="phone-note"
              />
            </div>
          </label>
          <p id="phone-note" className="phone-note">
            Gunakan nomor yang terdaftar sebagai member.
          </p>
          {entryMessage && (
            <p className="inline-error" role="alert">
              {entryMessage}
            </p>
          )}
          {!challenge ? (
            <button
              className="button primary"
              disabled={!isValidIndonesianPhone(phone)}
              onClick={requestOtp}
            >
              Kirim kode OTP
            </button>
          ) : (
            <div className="otp-block">
              <label htmlFor="otp">Kode OTP</label>
              <input
                id="otp"
                aria-describedby="otp-note"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="_ _ _ _ _ _"
              />
              <button className="button primary" disabled={code.length !== 6} onClick={verifyOtp}>
                Verifikasi
              </button>
              <button
                className="resend"
                onClick={() => {
                  setChallenge('');
                  setCode('');
                }}
              >
                Kirim ulang kode
              </button>
            </div>
          )}
          <p id="otp-note" className="security-note">
            Kode berlaku selama beberapa menit.
            <br />
            Jangan berikan kode kepada siapa pun.
          </p>
        </section>
      </main>
    );
  return (
    <main className="portal-shell">
      <header className="member-header">
        <p className="business-name">{portal.businessName}</p>
        <h1>Halo, {portal.memberName}</h1>
        <p className="member-number">
          Member {portal.memberNumber}
          {portal.status === 'ACTIVE' && <span className="badge">AKTIF</span>}
        </p>
      </header>
      <section className="points-card">
        <small>POINT SAYA</small>
        <strong>{formatNumber(portal.pointsBalance)}</strong>
        <span>point</span>
      </section>
      <nav className="portal-tabs" aria-label="Riwayat member">
        <button
          onClick={() => {
            setTab('points');
            setOffset(0);
            setItems([]);
            setHasMore(true);
          }}
          className={tab === 'points' ? 'active' : ''}
        >
          Riwayat Point
        </button>
        <button
          onClick={() => {
            setTab('transactions');
            setOffset(0);
            setItems([]);
            setHasMore(true);
          }}
          className={tab === 'transactions' ? 'active' : ''}
        >
          Transaksi
        </button>
      </nav>
      {items.map((x) => (
        <article
          className={`history-row ${x.type ? 'point-row' : 'transaction-row'}`}
          key={x.id ?? x.reference}
          role={x.lines ? 'button' : undefined}
          tabIndex={x.lines ? 0 : undefined}
          onClick={() =>
            x.lines &&
            setSelectedTransaction(selectedTransaction === x.reference ? '' : x.reference)
          }
          onKeyDown={(event) => {
            if (x.lines && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              setSelectedTransaction(selectedTransaction === x.reference ? '' : x.reference);
            }
          }}
        >
          <span
            className={`activity-icon ${Number(x.pointsDelta ?? 0) >= 0 ? 'positive' : 'negative'}`}
          >
            {x.type ? (Number(x.pointsDelta) >= 0 ? '+' : '−') : '≡'}
          </span>
          <div className="history-copy">
            <b>
              {x.type
                ? ((
                    {
                      EARN: 'Point diperoleh',
                      REDEEM: 'Point digunakan',
                      EARN_REVERSAL: 'Point dibatalkan',
                      REDEEM_REVERSAL: 'Point dikembalikan',
                    } as Record<string, string>
                  )[x.type] ?? x.type)
                : displayReference(x.reference)}
            </b>
            <span
              className={
                x.type ? undefined : `status ${x.status === 'SELESAI' ? 'success' : 'cancelled'}`
              }
            >
              {x.type ? displayReference(x.reference) : x.status}
            </span>
            <p>{formatDate(x.createdAt ?? x.occurredAt)}</p>
          </div>
          <strong className={Number(x.pointsDelta ?? 0) >= 0 ? 'positive-text' : 'negative-text'}>
            {x.type
              ? `${Number(x.pointsDelta) >= 0 ? '+' : ''}${formatNumber(x.pointsDelta)} point`
              : formatMoney(x.total, x.currency)}
          </strong>
          {x.lines &&
            selectedTransaction === x.reference &&
            x.lines.map((l: any) => (
              <p key={l.name}>
                {l.name} · {formatNumber(l.quantity)} × {formatMoney(l.total, x.currency)}
              </p>
            ))}
        </article>
      ))}
      {hasMore && (
        <button className="load-more" onClick={() => setOffset((v) => v + 20)}>
          Muat lebih banyak
        </button>
      )}
      <button
        className="logout"
        onClick={() => call('/logout', { method: 'POST' }).then(() => location.reload())}
      >
        Keluar dari portal
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
