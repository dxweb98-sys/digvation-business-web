import { DBadge, DButton, DSkeleton } from '@digvation/ui';
import {
  ChevronDown,
  Coins,
  House,
  Minus,
  Plus,
  ReceiptText,
  Undo2,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

export interface PortalSummary {
  businessName: string;
  memberName: string;
  memberNumber: string;
  status: string;
  pointsBalance: string;
}
export interface PointEntry {
  id: string;
  type: string;
  pointsDelta: string;
  reference: string | null;
  createdAt: string;
}
export interface TransactionLine {
  name: string;
  quantity: string;
  total: string;
}
export interface TransactionEntry {
  reference: string;
  status: string;
  total: string;
  currency: string;
  occurredAt: string;
  lines: TransactionLine[];
}
export type PortalView = 'home' | 'points' | 'transactions' | 'profile';

export interface HistoryState<T> {
  items: T[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: boolean;
}

const POINT_LABEL: Record<string, string> = {
  EARN: 'Poin diperoleh',
  REDEEM: 'Poin digunakan',
  EARN_REVERSAL: 'Poin dibatalkan',
  REDEEM_REVERSAL: 'Poin dikembalikan',
};

export const formatNumber = (value: string | number) =>
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
/** Keeps large balances on one line: the figure shrinks instead of wrapping. */
const balanceSize = (formatted: string) =>
  formatted.length > 9 ? 'sm' : formatted.length > 7 ? 'md' : 'lg';

/**
 * Business identity: the real logo when one is configured, otherwise the business name as a clean
 * wordmark. Nothing is drawn or invented when there is no asset.
 */
export function BrandBar({ name, logoUrl }: { name: string; logoUrl?: string | undefined }) {
  return (
    <div className="brand-bar">
      {logoUrl && <img className="portal-logo" src={logoUrl} alt="" />}
      <span className="portal-brand-name">{name}</span>
    </div>
  );
}

export function AuthHero({
  brandName,
  logoUrl,
  title,
  lead,
}: {
  brandName: string;
  logoUrl?: string | undefined;
  title: string;
  lead: string;
}) {
  return (
    <header className="hero hero--auth">
      <BrandBar name={brandName} logoUrl={logoUrl} />
      <div className="hero-copy">
        <h1 id="hero-title">{title}</h1>
        <p className="hero-lead">{lead}</p>
      </div>
    </header>
  );
}

/** Warm hero with a translucent membership card that carries the balance. */
export function MemberHero({
  summary,
  logoUrl,
  compact,
}: {
  summary: PortalSummary;
  logoUrl?: string | undefined;
  compact: boolean;
}) {
  const formatted = formatNumber(summary.pointsBalance);
  return (
    <header className={compact ? 'hero hero--compact' : 'hero'}>
      <BrandBar name={summary.businessName} logoUrl={logoUrl} />
      {!compact && (
        <div className="hero-member">
          <p className="hero-greeting">Halo,</p>
          <h1 className="hero-name">{summary.memberName}</h1>
        </div>
      )}
      <section className="member-card" aria-label="Poin saya">
        <span className="balance-label">Poin saya</span>
        <span className="balance-figure">
          <strong className="balance-value" data-size={balanceSize(formatted)}>
            {formatted}
          </strong>
          <span className="balance-unit">poin</span>
        </span>
        {!compact && (
          <p className="card-meta">
            <span>Member {summary.memberNumber}</span>
            {summary.status === 'ACTIVE' && <span className="hero-status">Aktif</span>}
          </p>
        )}
      </section>
    </header>
  );
}

export function Section({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <section className="section" aria-label={title}>
      <div className="section-head">
        <h2>{title}</h2>
        {onSeeAll && (
          <button type="button" className="see-all" onClick={onSeeAll}>
            Lihat semua
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="group group--skeleton" role="status" aria-live="polite">
      <span className="sr-only">Memuat…</span>
      <DSkeleton height={48} count={rows} />
    </div>
  );
}

/** Empty and error states stay inside the section group as one quiet message. */
function InlineNote({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="group inline-note">
      <p className="inline-note-title">{title}</p>
      {description && <p className="inline-note-text">{description}</p>}
      {action}
    </div>
  );
}

const POINT_ICON: Record<string, { Icon: LucideIcon; tone: string }> = {
  EARN: { Icon: Plus, tone: 'is-earn' },
  REDEEM: { Icon: Minus, tone: 'is-redeem' },
  EARN_REVERSAL: { Icon: Undo2, tone: 'is-reversal' },
  REDEEM_REVERSAL: { Icon: Undo2, tone: 'is-reversal' },
};

export function PointRow({ entry }: { entry: PointEntry }) {
  const delta = Number(entry.pointsDelta);
  const { Icon, tone } = POINT_ICON[entry.type] ?? {
    Icon: delta >= 0 ? Plus : Minus,
    tone: 'is-earn',
  };
  return (
    <li className="row">
      <span className={`row-icon ${tone}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <span className="row-copy">
        <b>{POINT_LABEL[entry.type] ?? entry.type}</b>
        <span className="row-sub">
          {displayReference(entry.reference)} · {formatDate(entry.createdAt)}
        </span>
      </span>
      <strong className={delta >= 0 ? 'delta-up' : 'delta-down'}>
        {`${delta >= 0 ? '+' : ''}${formatNumber(entry.pointsDelta)}`}
      </strong>
    </li>
  );
}

export function TransactionRow({ entry }: { entry: TransactionEntry }) {
  const [open, setOpen] = useState(false);
  const cancelled = entry.status !== 'SELESAI';
  return (
    <li className="row row--stacked">
      <button
        type="button"
        className="row-main"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="row-icon is-receipt" aria-hidden="true">
          <ReceiptText size={16} strokeWidth={2} />
        </span>
        <span className="row-copy">
          <b>{displayReference(entry.reference)}</b>
          <span className="row-sub">
            {formatDate(entry.occurredAt)}
            {cancelled && <span className="row-flag"> · Dibatalkan</span>}
          </span>
        </span>
        <span className="row-amount">
          <strong>{formatMoney(entry.total, entry.currency)}</strong>
          <ChevronDown
            aria-hidden="true"
            size={16}
            className={open ? 'chevron is-open' : 'chevron'}
          />
        </span>
      </button>
      {open && (
        <ul className="row-lines">
          {entry.lines.map((line) => (
            <li key={line.name}>
              <span>
                {line.name} · {formatNumber(line.quantity)}
              </span>
              <span>{formatMoney(line.total, entry.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function HistoryList<T>({
  state,
  empty,
  skeletonRows,
  limit,
  onRetry,
  render,
}: {
  state: HistoryState<T>;
  empty: { title: string; description: string };
  skeletonRows: number;
  limit?: number;
  onRetry: () => void;
  render: (item: T) => ReactNode;
}) {
  if (state.loading) return <ListSkeleton rows={skeletonRows} />;
  if (state.error && state.items.length === 0)
    return (
      <InlineNote
        title="Riwayat belum dapat dimuat"
        description="Periksa koneksi Anda lalu coba lagi."
        action={
          <button type="button" className="text-button" onClick={onRetry}>
            Coba lagi
          </button>
        }
      />
    );
  if (state.items.length === 0)
    return <InlineNote title={empty.title} description={empty.description} />;
  const items = limit ? state.items.slice(0, limit) : state.items;
  return <ul className="group feed">{items.map(render)}</ul>;
}

export function HomeView({
  points,
  transactions,
  goTo,
  retry,
}: {
  points: HistoryState<PointEntry>;
  transactions: HistoryState<TransactionEntry>;
  goTo: (view: PortalView) => void;
  retry: (kind: 'points' | 'transactions') => void;
}) {
  return (
    <>
      <Section
        title="Aktivitas poin"
        onSeeAll={points.items.length ? () => goTo('points') : undefined}
      >
        <HistoryList
          state={points}
          limit={3}
          skeletonRows={3}
          empty={{
            title: 'Belum ada aktivitas poin',
            description: 'Poin akan muncul setelah Anda bertransaksi sebagai member.',
          }}
          onRetry={() => retry('points')}
          render={(entry) => <PointRow key={entry.id} entry={entry} />}
        />
      </Section>
      <Section
        title="Transaksi terakhir"
        onSeeAll={transactions.items.length ? () => goTo('transactions') : undefined}
      >
        <HistoryList
          state={transactions}
          limit={3}
          skeletonRows={2}
          empty={{
            title: 'Belum ada transaksi',
            description: 'Transaksi member Anda akan tampil di sini.',
          }}
          onRetry={() => retry('transactions')}
          render={(entry) => <TransactionRow key={entry.reference} entry={entry} />}
        />
      </Section>
    </>
  );
}

export function PointsView({
  state,
  loadMore,
  retry,
}: {
  state: HistoryState<PointEntry>;
  loadMore: () => void;
  retry: () => void;
}) {
  return (
    <Section title="Riwayat poin">
      <HistoryList
        state={state}
        skeletonRows={5}
        empty={{
          title: 'Belum ada riwayat poin',
          description: 'Riwayat akan muncul setelah Anda bertransaksi sebagai member.',
        }}
        onRetry={retry}
        render={(entry) => <PointRow key={entry.id} entry={entry} />}
      />
      <LoadMore state={state} onClick={loadMore} />
    </Section>
  );
}

export function TransactionsView({
  state,
  loadMore,
  retry,
}: {
  state: HistoryState<TransactionEntry>;
  loadMore: () => void;
  retry: () => void;
}) {
  return (
    <Section title="Riwayat transaksi">
      <HistoryList
        state={state}
        skeletonRows={4}
        empty={{
          title: 'Belum ada transaksi',
          description: 'Transaksi member Anda akan tampil di sini.',
        }}
        onRetry={retry}
        render={(entry) => <TransactionRow key={entry.reference} entry={entry} />}
      />
      <LoadMore state={state} onClick={loadMore} />
    </Section>
  );
}

function LoadMore<T>({ state, onClick }: { state: HistoryState<T>; onClick: () => void }) {
  if (state.loading || state.items.length === 0 || !state.hasMore) return null;
  return (
    <DButton variant="outline" fullWidth loading={state.loadingMore} onClick={onClick}>
      Muat lebih banyak
    </DButton>
  );
}

export function ProfileView({
  summary,
  onLogout,
}: {
  summary: PortalSummary;
  onLogout: () => void;
}) {
  return (
    <>
      <Section title="Profil member">
        <dl className="group profile">
          <div>
            <dt>Nama</dt>
            <dd>{summary.memberName}</dd>
          </div>
          <div>
            <dt>Nomor member</dt>
            <dd>{summary.memberNumber}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {summary.status === 'ACTIVE' ? (
                <DBadge variant="success" dot>
                  Aktif
                </DBadge>
              ) : (
                'Tidak aktif'
              )}
            </dd>
          </div>
          <div>
            <dt>Tempat terdaftar</dt>
            <dd>{summary.businessName}</dd>
          </div>
        </dl>
      </Section>
      <DButton variant="outline" fullWidth onClick={onLogout}>
        Keluar dari portal
      </DButton>
    </>
  );
}

const NAV: Array<{ view: PortalView; label: string; Icon: LucideIcon }> = [
  { view: 'home', label: 'Beranda', Icon: House },
  { view: 'points', label: 'Poin', Icon: Coins },
  { view: 'transactions', label: 'Transaksi', Icon: ReceiptText },
  { view: 'profile', label: 'Profil', Icon: UserRound },
];

/** Floating frosted bar that belongs to the same warm surface as the content. */
export function BottomNav({
  view,
  onChange,
}: {
  view: PortalView;
  onChange: (view: PortalView) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navigasi portal">
      {NAV.map(({ view: item, label, Icon }) => (
        <button
          key={item}
          type="button"
          className={item === view ? 'is-active' : ''}
          aria-current={item === view ? 'page' : undefined}
          onClick={() => onChange(item)}
        >
          <Icon aria-hidden="true" size={21} strokeWidth={item === view ? 2.25 : 1.75} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
