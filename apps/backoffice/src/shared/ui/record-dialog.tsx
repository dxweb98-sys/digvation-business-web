import { DButton } from '@digvation/ui';
import type { ReactNode } from 'react';

import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

/**
 * Presentation primitives of the Backoffice record dialog family (Catalog hierarchy):
 * brand-marked title, rounded bordered panels, quiet section labels, info tiles, and footer.
 * They carry no business meaning; each feature composes them with its own copy and badges.
 */

const EMPTY_VALUE = '—';

/** Dialog title: brand dot, action, then optional identity/status badges. */
export function RecordDialogTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
      <span>{title}</span>
      {children}
    </div>
  );
}

export function RecordDialogFooter({
  onClose,
  onSave,
  disabled = false,
  saving = false,
  saveLabel,
}: {
  onClose: () => void;
  onSave: () => void;
  disabled?: boolean;
  saving?: boolean;
  saveLabel?: string;
}) {
  const { copy } = useBackofficeLocalization();
  return (
    <div className="flex justify-end gap-2">
      <DButton variant="secondary" onClick={onClose} disabled={saving}>
        {copy('Cancel')}
      </DButton>
      <DButton onClick={onSave} disabled={disabled} loading={saving}>
        {saveLabel ?? copy('Save')}
      </DButton>
    </div>
  );
}

export function RecordPanel({
  children,
  className = '',
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function RecordSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

export function RecordInfoTile({
  label,
  value,
  icon,
  mono = false,
  className = '',
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  mono?: boolean;
  className?: string;
}) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div
      className={`min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        {icon ? <span className="text-[var(--color-brand)]">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div
        className={`mt-1.5 break-words text-sm font-semibold ${
          empty ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text)]'
        } ${mono && !empty ? 'font-mono' : ''}`}
      >
        {empty ? EMPTY_VALUE : value}
      </div>
    </div>
  );
}
