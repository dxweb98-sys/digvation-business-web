import {
  DBadge,
  DButton,
  DConfirmDialog,
  DCurrencyInput,
  DDataTable,
  DDatePicker,
  DDialog,
  DInfoNote,
  useToast,
} from '@digvation/ui';
import { ArrowRight, Ban } from 'lucide-react';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type { CatalogApi, CatalogManagementItem, PriceHistoryEntry } from '../api/catalog-api';
import { useCatalogLocalization } from '../localization/use-catalog-localization';
import {
  priceChangeActorLabel,
  priceHistoryTarget,
  type VariantPriceState,
} from '../model/catalog-price-history';
import { isValidSellingPrice } from '../item-editor/model/variant-price-draft';

const EFFECTIVE_FROM = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const nowLocalMinute = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function useEffectiveFrom() {
  const [effectiveFrom, setEffectiveFrom] = useState(nowLocalMinute);
  const [chosen, setChosen] = useState(false);
  return {
    effectiveFrom,
    setEffectiveFrom: (value: string) => {
      setChosen(true);
      setEffectiveFrom(value);
    },
    valid: EFFECTIVE_FROM.test(effectiveFrom),
    // The picker is minute-precise; an untouched default means "now", so consecutive changes
    // within the same minute do not collide at one effective instant.
    toIso: () => (chosen ? new Date(effectiveFrom) : new Date()).toISOString(),
  };
}

function useSaveError() {
  const { showToast } = useToast();
  return (error: unknown, fallback: string) => {
    if (!isSessionExpiredError(error))
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(error, fallback).safeMessage,
      });
  };
}

export function VariantPriceLabel({ state }: { state: VariantPriceState }) {
  const { copy, formatMoney } = useCatalogLocalization();
  if (state.kind === 'loading')
    return <span className="text-[var(--color-text-muted)]">{copy('Loading...')}</span>;
  if (state.kind === 'missing')
    return <DBadge variant="warning">{copy('No variant price')}</DBadge>;
  if (state.kind === 'unavailable')
    return (
      <span className="text-xs text-[var(--color-text-muted)]">
        {copy('Shown when the item is active')}
      </span>
    );
  return <p>{formatMoney(state.amount, state.currency)}</p>;
}

export function ItemPriceHistory({
  entries,
  loading,
  error,
  canCancel,
  onCancel,
}: {
  entries: PriceHistoryEntry[];
  loading: boolean;
  error: boolean;
  canCancel: boolean;
  onCancel: (price: PriceHistoryEntry) => Promise<void>;
}) {
  const [pending, setPending] = useState<PriceHistoryEntry | null>(null);
  const { showToast } = useToast();
  const onError = useSaveError();
  const { copy, formatDate, formatMoney } = useCatalogLocalization();
  const dateTime = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });

  if (error)
    return <DInfoNote variant="danger">{copy('Price history could not be loaded.')}</DInfoNote>;
  return (
    <>
      <DDataTable
        columns={[
          {
            key: 'target',
            label: copy('Price for'),
            render: (entry: PriceHistoryEntry) => {
              const target = priceHistoryTarget(entry);
              return (
                <div className="min-w-0">
                  <p className="font-medium">
                    {target.scope === 'ITEM' ? copy('Item price') : target.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {target.scope === 'ITEM' ? copy('Parent item') : copy('Variant')}
                    {target.sku ? ` · SKU ${target.sku}` : ''}
                  </p>
                </div>
              );
            },
          },
          {
            key: 'change',
            label: copy('Price change'),
            render: (entry: PriceHistoryEntry) => (
              <div className="flex flex-wrap items-center gap-1.5 tabular-nums">
                {entry.previousAmount ? (
                  <>
                    <span className="text-[var(--color-text-muted)]">
                      {formatMoney(entry.previousAmount, entry.currency)}
                    </span>
                    <ArrowRight
                      className="size-3.5 text-[var(--color-text-muted)]"
                      aria-label={copy('changed to')}
                    />
                  </>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {copy('First price')} ·
                  </span>
                )}
                <span className="font-semibold">{formatMoney(entry.amount, entry.currency)}</span>
              </div>
            ),
          },
          {
            key: 'effectiveFrom',
            label: copy('Effective from'),
            render: (entry: PriceHistoryEntry) => dateTime(entry.effectiveFrom),
          },
          {
            key: 'changedBy',
            label: copy('Changed by'),
            render: (entry: PriceHistoryEntry) => (
              <div>
                <p>{priceChangeActorLabel(entry)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {dateTime(entry.createdAt)}
                </p>
              </div>
            ),
          },
          {
            key: 'cancelledAt',
            label: copy('Status'),
            render: (entry: PriceHistoryEntry) =>
              entry.cancelledAt ? (
                <DBadge variant="secondary">{copy('Cancelled')}</DBadge>
              ) : (
                <DBadge variant="success">{copy('Recorded')}</DBadge>
              ),
          },
        ]}
        data={entries}
        loading={loading}
        rowKey="id"
        emptyMessage={copy('No price changes yet.')}
        actions={[
          {
            label: copy('Cancel price'),
            icon: <Ban className="size-4" />,
            variant: 'danger',
            onClick: setPending,
            show: (price) => canCancel && !price.cancelledAt,
          },
        ]}
      />
      <DConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          void onCancel(pending)
            .then(() => {
              showToast({ variant: 'success', title: copy('Price cancelled.') });
              setPending(null);
            })
            .catch((error) => onError(error, copy('Could not cancel price.')));
        }}
        title={copy('Cancel price?')}
        message={copy('Price history is retained, but this price no longer applies.')}
        confirmLabel={copy('Cancel price')}
        variant="danger"
      />
    </>
  );
}

function EffectiveFromField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { copy } = useCatalogLocalization();
  return (
    <DDatePicker
      label={copy('Effective from')}
      value={value}
      onChange={onChange}
      variant="date-time"
      placeholder={copy('Select the date the price takes effect')}
    />
  );
}

export function PriceChangeDialog({
  open,
  item,
  currency,
  api,
  onClose,
  onSaved,
}: {
  open: boolean;
  item: CatalogManagementItem;
  currency: string;
  api: CatalogApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const onError = useSaveError();
  const { copy } = useCatalogLocalization();
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const effective = useEffectiveFrom();
  const validAmount = isValidSellingPrice(amount);

  const save = async () => {
    if (!open || !validAmount || !effective.valid || saving) return;
    setSaving(true);
    try {
      await api.changePrice({
        catalogItemId: item.id,
        catalogVariantId: null,
        locationId: null,
        currency,
        amount: amount.trim(),
        effectiveFrom: effective.toIso(),
      });
      onSaved();
      showToast({ variant: 'success', title: copy('Price updated.') });
      onClose();
    } catch (error) {
      onError(error, copy('Could not update price.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Change item price')}
      description={copy(
        'A new price is added to effective history; the previous price is unchanged.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton
            onClick={() => void save()}
            disabled={!validAmount || !effective.valid}
            loading={saving}
          >
            {copy('Save price')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DCurrencyInput
          label={`${copy('New price')} (${currency})`}
          value={amount}
          onValueChange={setAmount}
          placeholder={copy('For example, 100000')}
        />
        <EffectiveFromField value={effective.effectiveFrom} onChange={effective.setEffectiveFrom} />
      </div>
    </DDialog>
  );
}
