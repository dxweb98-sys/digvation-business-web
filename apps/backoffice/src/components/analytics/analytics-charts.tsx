import { DCard } from '@digvation/ui';
import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import type { ReactNode } from 'react';

export type AnalyticsPoint = { label: string; value: string; count?: number };
const numeric = (value: string) => Number(value) || 0;
const surface = 'rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_14px_34px_-28px_var(--color-text)] sm:p-6';

export function AnalyticsLineChart({ title, subtitle, data, formatValue, emptyMessage, pointsLabel }: { title: string; subtitle: string; data: AnalyticsPoint[]; formatValue: (value: string) => string; emptyMessage: string; pointsLabel: string }) {
  const values = data.map((point) => numeric(point.value));
  const hasActivity = values.some((value) => value !== 0);
  const max = Math.max(...values, 1);
  const width = 640;
  const height = 220;
  const points = data.map((point, index) => `${data.length === 1 ? width / 2 : index / (data.length - 1) * width},${height - numeric(point.value) / max * (height - 30) - 15}`).join(' ');

  return <DCard variant="elevated" className={`${surface} min-h-[410px] lg:col-span-2`}>
    <header className="flex items-start justify-between gap-4">
      <div><h2 className="text-sm font-semibold tracking-tight">{title}</h2><p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">{subtitle}</p></div>
      {hasActivity ? <span className="rounded-full bg-[var(--color-accent-sky)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand)]">{data.length} {pointsLabel}</span> : null}
    </header>
    {hasActivity ? <>
      <svg className="mt-8 h-60 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
        <defs><linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-brand)" stopOpacity=".2"/><stop offset="1" stopColor="var(--color-brand)" stopOpacity=".015"/></linearGradient></defs>
        {[.25, .5, .75].map((fraction) => <line key={fraction} x1="0" x2={width} y1={height * fraction} y2={height * fraction} stroke="var(--color-border)" strokeOpacity=".38" strokeDasharray="3 8" />)}
        <path d={`M ${points.split(' ').join(' L ')} L ${width} ${height} L 0 ${height} Z`} fill="url(#analytics-area)" />
        <polyline points={points} fill="none" stroke="var(--color-brand)" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((point, index) => <circle key={point.label} cx={data.length === 1 ? width / 2 : index / (data.length - 1) * width} cy={height - numeric(point.value) / max * (height - 30) - 15} r="3.5" fill="var(--color-surface)" stroke="var(--color-brand)" strokeWidth="2.5"><title>{point.label}: {formatValue(point.value)}</title></circle>)}
      </svg>
      <div className="flex justify-between text-[11px] font-medium text-[var(--color-text-muted)]"><span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span></div>
    </> : <AnalyticsEmptyState message={emptyMessage} className="h-[300px]" />}
  </DCard>;
}

export function AnalyticsDonutChart({ title, data, emptyMessage, totalLabel, formatValue }: { title: string; data: AnalyticsPoint[]; emptyMessage: string; totalLabel: string; formatValue: (value: number) => string }) {
  const total = data.reduce((sum, point) => sum + (point.count ?? numeric(point.value)), 0);
  let offset = 0;
  const colors = ['var(--color-brand)', 'var(--color-accent-sky)', 'var(--color-accent-mint)', 'var(--color-accent-yellow)', 'var(--color-accent-lavender)'];
  return <DCard variant="elevated" className={surface}>
    <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
    {total ? <div className="mt-5 grid grid-cols-[112px_1fr] items-center gap-4">
      <div className="relative"><svg viewBox="0 0 42 42" className="h-28 w-28 -rotate-90" role="img" aria-label={title}><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-surface-muted)" strokeWidth="5.5" />{data.map((point, index) => { const amount = point.count ?? numeric(point.value); const percent = amount / total * 100; const node = <circle key={point.label} cx="21" cy="21" r="15.9" fill="none" stroke={colors[index % colors.length]} strokeWidth="5.5" strokeDasharray={`${percent} ${100 - percent}`} strokeDashoffset={-offset}><title>{point.label}: {formatValue(amount)}</title></circle>; offset += percent; return node; })}</svg><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-base tabular-nums">{formatValue(total)}</strong><span className="text-[10px] text-[var(--color-text-muted)]">{totalLabel}</span></div></div>
      <div className="space-y-2.5">{data.map((point, index) => { const value = point.count ?? numeric(point.value); return <div key={point.label} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 text-[var(--color-text-muted)]"><i className="size-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} /><span className="truncate">{point.label}</span></span><b className="font-semibold tabular-nums">{formatValue(value)}</b></div>; })}</div>
    </div> : <AnalyticsEmptyState message={emptyMessage} />}
  </DCard>;
}

export function AnalyticsHorizontalBarChart({ title, data, formatValue, emptyMessage }: { title: string; data: AnalyticsPoint[]; formatValue: (value: string) => string; emptyMessage: string }) {
  const active = data.filter((point) => numeric(point.value) !== 0);
  const max = Math.max(...active.map((point) => numeric(point.value)), 1);
  return <DCard variant="elevated" className={`${surface} lg:col-span-2`}><h2 className="text-sm font-semibold tracking-tight">{title}</h2><div className="mt-5 space-y-3.5">{active.length ? active.map((point, index) => <div key={point.label}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className={index === 0 ? 'truncate font-semibold' : 'truncate text-[var(--color-text-muted)]'}>{index + 1}. {point.label}</span><strong className="tabular-nums">{formatValue(point.value)}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"><div className={`h-full rounded-full bg-[var(--color-brand)] ${index === 0 ? '' : 'opacity-45'}`} style={{ width: `${numeric(point.value) / max * 100}%` }} /></div></div>) : <AnalyticsEmptyState message={emptyMessage} />}</div></DCard>;
}

export function AnalyticsInsightCard({ title, children, tone = 'neutral' }: { title: string; children: ReactNode; tone?: 'neutral' | 'primary' }) {
  return <DCard variant="elevated" className={`${surface} ${tone === 'primary' ? 'bg-[var(--color-surface-muted)]' : ''}`}><h2 className="text-sm font-semibold tracking-tight">{title}</h2><div className="mt-4">{children}</div></DCard>;
}

export function AnalyticsEmptyState({ message, className = 'h-36' }: { message: string; className?: string }) { return <div className={`mt-4 flex ${className} flex-col items-center justify-center rounded-xl bg-[var(--color-surface-muted)] px-6 text-center text-xs leading-5 text-[var(--color-text-muted)]`}><span className="mb-3 flex size-10 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-brand)] shadow-sm"><ChartNoAxesColumnIncreasing aria-hidden="true" className="size-4" /></span><span className="max-w-xs">{message}</span></div>; }
