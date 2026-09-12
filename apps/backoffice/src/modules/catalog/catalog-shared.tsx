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
