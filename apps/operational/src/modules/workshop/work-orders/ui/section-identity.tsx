import { cn } from '@digvation/ui';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Section identity for the Work Order surfaces. Every major surface answers
 * "what is this?" with a marker of its own family, instead of leaning on its
 * position:
 *
 * - identity   customer, vehicle, mechanic: who and what the job is for
 * - work       the items being performed: the solid, strongest marker
 * - selection  the draft being assembled in a picker
 * - financial  billing: an ink base, the only dark surface
 * - history    the change timeline
 * - danger     cancellation
 *
 * The families share one shape language (rounded tile + glyph) and differ in
 * hue and weight, so they read as related but never as the same grey box.
 */
export type SectionTone = 'identity' | 'work' | 'selection' | 'financial' | 'history' | 'danger';

const TILE: Record<SectionTone, string> = {
  identity: 'bg-(--color-brand)/10 text-(--color-brand)',
  work: 'bg-(--color-brand) text-white shadow-[0_1px_2px_rgba(16,24,40,0.2)]',
  selection: 'bg-(--color-success)/12 text-(--color-success)',
  financial: 'bg-white/12 text-white',
  history: 'bg-(--color-warning)/15 text-(--color-warning)',
  danger: 'bg-(--color-danger)/10 text-(--color-danger)',
};

export function SectionMark({
  icon: Icon,
  tone,
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  tone: SectionTone;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center',
        size === 'sm' && 'size-7 rounded-lg',
        size === 'md' && 'size-9 rounded-xl',
        size === 'lg' && 'size-14 rounded-2xl',
        TILE[tone],
        className,
      )}
    >
      <Icon
        className={size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-7' : 'size-[18px]'}
        aria-hidden="true"
      />
    </span>
  );
}

/**
 * Header of a major surface: marker, title, secondary meta, and the actions
 * that belong to this surface on the right.
 */
export function SectionHeader({
  icon,
  tone,
  title,
  meta,
  actions,
  className,
}: {
  icon: LucideIcon;
  tone: SectionTone;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex min-h-14 shrink-0 items-center gap-3 px-4 py-2.5', className)}>
      <SectionMark icon={icon} tone={tone} />
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h3 className="truncate text-[15px] font-semibold leading-tight text-(--color-text)">
          {title}
        </h3>
        {meta}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

/** Small secondary count next to a title, e.g. "7 items". */
export function CountPill({
  children,
  tone = 'brand',
}: {
  children: ReactNode;
  tone?: 'brand' | 'success';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        tone === 'success'
          ? 'bg-(--color-success)/15 text-(--color-success)'
          : 'bg-(--color-brand)/10 text-(--color-brand)',
      )}
    >
      {children}
    </span>
  );
}

/** Raised white surface on the tinted canvas: the one object shape for a whole section. */
export const SURFACE_RAISED =
  'bg-(--color-surface) shadow-[0_1px_2px_rgba(16,24,40,0.06),0_4px_12px_-2px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.06]';
