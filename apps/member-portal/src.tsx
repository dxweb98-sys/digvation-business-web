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
function App() {
  const [entry, setEntry] = useState<any>();
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [portal, setPortal] = useState<any>();
  const [tab, setTab] = useState<'points' | 'transactions'>('points');
  const [items, setItems] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    call(`/entry/${handle}`)
      .then(setEntry)
      .catch(() => setError('Tautan member tidak tersedia.'));
  }, []);
  useEffect(() => {
    if (!portal) return;
    call(`/${tab}?offset=${offset}&limit=20`)
      .then((x) => setItems((v) => (offset ? v.concat(x.items) : x.items)))
      .catch(() => setError('Sesi telah berakhir.'));
  }, [portal, tab, offset]);
  if (error)
    return (
      <main>
        <h1>Member Portal</h1>
        <p>{error}</p>
      </main>
    );
  if (!entry) return <main className="skeleton">Memuat…</main>;
  if (!portal)
    return (
      <main>
        <p className="brand">Member Portal</p>
        <h1>Verifikasi nomor Anda</h1>
        <p>Kode akan dikirim ke {entry.phoneHint}</p>
        <button
          onClick={async () => {
            const x = await call('/otp', { method: 'POST', body: JSON.stringify({ handle }) });
            setChallenge(x.challengeId ?? '');
          }}
        >
          Kirim kode OTP
        </button>
        <input
          aria-label="Kode OTP"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6 digit"
        />
        <button
          disabled={code.length !== 6}
          onClick={async () => {
            await call('/verify', {
              method: 'POST',
              body: JSON.stringify({ handle, challengeId: challenge, code }),
            });
            setPortal(await call('/summary'));
          }}
        >
          Masuk
        </button>
      </main>
    );
  return (
    <main>
      <p className="brand">{portal.businessName}</p>
      <h1>Halo, {portal.memberName}</h1>
      <p>Member {portal.memberNumber}</p>
      <section>
        <small>POINT SAYA</small>
        <strong>{portal.pointsBalance} point</strong>
      </section>
      <nav>
        <button
          onClick={() => {
            setTab('points');
            setOffset(0);
            setItems([]);
          }}
        >
          Riwayat Point
        </button>
        <button
          onClick={() => {
            setTab('transactions');
            setOffset(0);
            setItems([]);
          }}
        >
          Transaksi
        </button>
      </nav>
      {items.map((x) => (
        <article key={x.id ?? x.reference}>
          <b>{x.type ?? x.reference}</b>
          <span>{x.pointsDelta ?? x.total}</span>
          <p>{x.createdAt ?? x.occurredAt}</p>
          {x.lines?.map((l: any) => (
            <p key={l.name}>
              {l.name} × {l.quantity}
            </p>
          ))}
        </article>
      ))}
      <button onClick={() => setOffset((v) => v + 20)}>Muat lagi</button>
      <button onClick={() => call('/logout', { method: 'POST' }).then(() => location.reload())}>
        Keluar
      </button>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
