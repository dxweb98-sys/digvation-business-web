import { DBadge, DButton } from '@digvation/ui';
import type { ReactNode } from 'react';
import type { DefaultPrice } from '../api/catalog-api';
import { useCatalogLocalization } from '../localization/use-catalog-localization';

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
        className={`mt-1 break-words text-[var(--color-text)] ${
          emphasized ? 'text-base font-semibold' : 'text-sm font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function CatalogPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function CatalogPanelHeader({
  title,
  description,
  count,
  actions,
  icon,
  trailing,
  compact = false,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] ${
        compact ? 'px-4 py-3' : 'px-5 py-4'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-[var(--color-brand)]">{icon}</span> : null}
          <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>
          {count !== undefined ? <DBadge variant="secondary">{count}</DBadge> : null}
          {trailing}
        </div>
        {description ? (
          <p className="mt-0.5 text-xs leading-5 text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CatalogInfoTile({
  label,
  value,
  icon,
  children,
  emphasized = false,
  className = '',
}: {
  label: string;
  value?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
        {icon ? <span className="text-[var(--color-brand)]">{icon}</span> : null}
        <span>{label}</span>
      </div>
      {value !== undefined ? (
        <div
          className={`mt-1.5 break-words text-[var(--color-text)] ${
            emphasized ? 'text-base font-semibold' : 'text-sm font-semibold'
          }`}
        >
          {value}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * One section of the Catalog item dialogs. Use for editor sections that are visually
 * connected inside one dialog. Detail surfaces should prefer CatalogPanel.
 */
export function CatalogSection({
  title,
  description,
  count,
  actions,
  icon,
  tone = 'primary',
  children,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'secondary';
  children: ReactNode;
}) {
  return (
    <section className="py-5 first:pt-0 last:pb-0" aria-label={title}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-[var(--color-brand)]">{icon}</span> : null}
            <h2
              className={
                tone === 'primary'
                  ? 'text-sm font-semibold uppercase tracking-[0.02em] text-[var(--color-text)]'
                  : 'text-sm font-semibold uppercase tracking-[0.02em] text-[var(--color-text)]'
              }
            >
              {title}
            </h2>
            {count !== undefined ? <DBadge variant="secondary">{count}</DBadge> : null}
          </div>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--color-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
