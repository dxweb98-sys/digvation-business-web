import { DBadge } from '@digvation/ui';
import type { ReactNode } from 'react';

import type { Status } from './members-api';
import { membershipCopy } from './membership-copy';

/* Membership-owned composition in the accepted Backoffice dialog language (see Catalog). */

export function MemberPanel({
  children,
  ariaLabel,
  className = '',
}: {
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function MemberSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

export function MemberDialogTitle({ title, badges }: { title: string; badges?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
      <span>{title}</span>
      {badges}
    </div>
  );
}

export function MemberStatusBadge({ status }: { status: Status }) {
  const copy = membershipCopy();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {status === 'ACTIVE' ? copy.active : copy.inactive}
    </DBadge>
  );
}

export function MemberNumberBadge({ memberNumber }: { memberNumber: string }) {
  return <DBadge variant="info">{memberNumber}</DBadge>;
}

export function MemberInfoTile({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        <span className="text-[var(--color-brand)]">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1.5 break-words text-sm font-medium text-[var(--color-text)]">{value}</div>
    </div>
  );
}
