import { DBadge, DButton, DPagination, DSelect, useToast } from '@digvation/ui';
import type { ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type { RecordStatus } from '../api/financial-accounts-api';
import { displayCode, EMPTY_VALUE } from '../model/financial-account-model';
import { useFinancialAccountsLocalization } from '../localization/use-financial-accounts-localization';

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  const { copy } = useFinancialAccountsLocalization();
  return (
    <DBadge variant={status === 'ACTIVE' ? 'success' : 'secondary'}>
      {copy(status === 'ACTIVE' ? 'Active' : 'Inactive')}
    </DBadge>
  );
}

/** Table identity cell: the name leads; the code (and optional context) follow on one quiet line. */
export function RecordIdentity({
  name,
  code,
  meta,
}: {
  name: string;
  code: string | null;
  meta?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="line-clamp-2 font-medium text-[var(--color-text)]" title={name}>
        {name}
      </p>
      <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
        {code?.trim() || !meta ? <span className="font-mono">{displayCode(code)}</span> : null}
        {code?.trim() && meta ? ' · ' : null}
        {meta}
      </p>
    </div>
  );
}

export function CodeChip({ code }: { code: string | null }) {
  return (
    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 font-mono text-[11px] text-[var(--color-text)]">
      {displayCode(code)}
    </span>
  );
}

/** Dialog title in the Backoffice dialog family: brand dot, action, identity, and status. */
export function FinancialDialogTitle({
  title,
  code,
  status,
}: {
  title: string;
  code?: string | null;
  status?: RecordStatus;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
      <span>{title}</span>
      {code !== undefined ? <DBadge variant="info">{displayCode(code)}</DBadge> : null}
      {status ? <RecordStatusBadge status={status} /> : null}
    </div>
  );
}

export function FinancialDialogFooter({
  onClose,
  onSave,
  disabled = false,
}: {
  onClose: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  const { copy } = useFinancialAccountsLocalization();
  return (
    <div className="flex justify-end gap-2">
      <DButton variant="secondary" onClick={onClose}>
        {copy('Cancel')}
      </DButton>
      <DButton onClick={onSave} disabled={disabled}>
        {copy('Save')}
      </DButton>
    </div>
  );
}

export function FinancialPanel({
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

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}

export function InfoTile({
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

/** A select over one server page of options, with simple previous/next paging beneath it. */
export function PagedSelect({
  label,
  value,
  onChange,
  options,
  loading,
  offset,
  pageSize,
  count,
  hasNext,
  onOffsetChange,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  loading: boolean;
  offset: number;
  pageSize: number;
  count: number;
  hasNext: boolean;
  onOffsetChange: (offset: number) => void;
  disabled?: boolean;
  hint?: ReactNode;
}) {
  const { copy } = useFinancialAccountsLocalization();
  const page = Math.floor(offset / pageSize) + 1;
  return (
    <div className="min-w-0">
      <DSelect
        label={label}
        value={value}
        placeholder={copy('Select an option')}
        options={options}
        loading={loading}
        disabled={disabled}
        hint={hint}
        onChange={(next) => onChange(String(next ?? ''))}
      />
      {count && (hasNext || offset > 0) ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-[var(--color-text-muted)]">
            {copy('Showing')} {offset + 1}–{offset + count}
          </span>
          <DPagination
            page={page}
            totalPages={page + (hasNext ? 1 : 0)}
            onChange={(next) => onOffsetChange((next - 1) * pageSize)}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Shows a normalized Runtime failure; expired sessions are handled by the auth boundary. */
export function useApiErrorToast() {
  const { copy } = useFinancialAccountsLocalization();
  const { showToast } = useToast();
  return (error: unknown, fallback: string) => {
    if (isSessionExpiredError(error)) return;
    const normalized = normalizeBackofficeApiError(error, fallback);
    showToast({
      variant: normalized.code === 'VERSION_CONFLICT' ? 'warning' : 'danger',
      title: copy(normalized.safeMessage),
    });
  };
}
