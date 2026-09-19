import { DBadge, DButton } from '@digvation/ui';
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

/**
 * One section of the Catalog item dialogs. `primary` sections hold what the user is here for
 * (identity, pricing, variants); `secondary` sections hold supporting or historical information.
 */
export function CatalogSection({
  title,
  description,
  count,
  actions,
  tone = 'primary',
  children,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  tone?: 'primary' | 'secondary';
  children: ReactNode;
}) {
  return (
    <section className="py-6 first:pt-0 last:pb-0" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2
              className={
                tone === 'primary'
                  ? 'text-base font-semibold text-[var(--color-text)]'
                  : 'text-sm font-semibold text-[var(--color-text-muted)]'
              }
            >
              {title}
            </h2>
            {count !== undefined ? <DBadge variant="secondary">{count}</DBadge> : null}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
