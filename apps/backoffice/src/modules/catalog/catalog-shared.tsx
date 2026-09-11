import { DBadge, DButton } from '@digvation/ui';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DefaultPrice } from './catalog-api';
import { useCatalogLocalization } from './catalog-localization';

export function humanize(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

export function Status({ value }: { value: string }) {
  const { copy } = useCatalogLocalization();
  const variant =
    value === 'ACTIVE'
      ? 'success'
      : value === 'DRAFT'
        ? 'warning'
        : value === 'INACTIVE'
          ? 'secondary'
          : value === 'CANCELLED'
            ? 'danger'
            : 'secondary';
  return <DBadge variant={variant}>{copy(humanize(value))}</DBadge>;
}

export function DialogFooter({
  onClose,
  onSave,
  disabled = false,
}: {
  onClose: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  const { copy } = useCatalogLocalization();
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

export function PriceLabel({
  price,
  loading,
  available = true,
  emptyLabel,
}: {
  price: DefaultPrice | undefined;
  loading: boolean;
  available?: boolean;
  emptyLabel?: string;
}) {
  const { copy, formatMoney } = useCatalogLocalization();
  if (!available) return <span className="text-[var(--color-text-muted)]">—</span>;
  if (loading)
    return (
      <span className="text-sm font-normal text-[var(--color-text-muted)]">
        {copy('Loading...')}
      </span>
    );
  return price ? (
    <span>{formatMoney(price.amount, price.currency)}</span>
  ) : (
    <span className="text-sm font-normal text-[var(--color-text-muted)]">
      {emptyLabel ?? copy('Not set')}
    </span>
  );
}

export function DetailField({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-words text-[var(--color-text)] ${emphasized ? 'text-base font-semibold' : 'text-sm font-medium'}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function CatalogAccordion({
  title,
  description,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  description?: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:hidden">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
            {count !== undefined ? <DBadge variant="secondary">{count}</DBadge> : null}
          </div>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--color-text-muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-[var(--color-border)] p-4">{children}</div>
    </details>
  );
}

export function TablePagination({
  page,
  pageSize,
  hasNext,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  hasNext: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const { copy } = useCatalogLocalization();
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span>{copy('Rows per page')}</span>
        <select
          aria-label={copy('Rows per page')}
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-brand)]"
        >
          {[10, 25, 50].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <span>· {copy('Page')} {page}</span>
      </div>
      <div className="flex items-center gap-2">
        <DButton
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <span className="inline-flex items-center gap-1.5">
            <ChevronLeft aria-hidden="true" className="size-4" />
            {copy('Previous')}
          </span>
        </DButton>
        <DButton variant="secondary" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          <span className="inline-flex items-center gap-1.5">
            {copy('Next')}
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        </DButton>
      </div>
    </div>
  );
}
