import {
  DButton,
  DConfirmDialog,
  DCurrencyInput,
  DDataTable,
  DDatePicker,
  DDialog,
  useToast,
} from '@digvation/ui';
import { Ban } from 'lucide-react';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { CatalogApi, CatalogManagementItem, Price, Variant } from './catalog-api';
import { useCatalogLocalization } from './catalog-localization';
import { Status } from './catalog-shared';

export function VariantPriceLabel({
  query,
  variantId,
  currency,
}: {
  query:
    | {
        data:
          | {
              amount: string;
              currency: string;
              sourceScope: { catalogVariantId: string | null };
            }
          | undefined;
        isLoading: boolean;
        isError: boolean;
      }
    | undefined;
  variantId: string;
  currency: string;
}) {
  const { copy, formatMoney } = useCatalogLocalization();
  if (!query || query.isLoading)
    return <span className="text-[var(--color-text-muted)]">{copy('Loading...')}</span>;
  if (query.isError || !query.data)
    return <span className="text-[var(--color-text-muted)]">{copy('Not set')}</span>;
  const inherited = query.data.sourceScope.catalogVariantId !== variantId;
  return (
    <div>
      <p>{formatMoney(query.data.amount, query.data.currency || currency)}</p>
      {inherited ? (
        <p className="text-xs text-[var(--color-text-muted)]">{copy('Uses default price')}</p>
      ) : null}
    </div>
  );
}

export function PriceHistoryTable({
  prices,
  currency,
  loading,
  canCancel,
  onCancel,
  emptyMessage,
}: {
  prices: Price[];
  currency: string;
  loading: boolean;
  canCancel: boolean;
  onCancel: (price: Price) => Promise<void>;
  emptyMessage: string;
}) {
  const [pending, setPending] = useState<Price | null>(null);
  const { showToast } = useToast();
  const { copy, formatDate, formatMoney } = useCatalogLocalization();
  return (
    <>
      <DDataTable
        columns={[
          {
            key: 'amount',
            label: copy('Price'),
            render: (price: Price) => formatMoney(price.amount, price.currency || currency),
          },
          {
            key: 'effectiveFrom',
            label: copy('Effective from'),
            render: (price: Price) =>
              formatDate(new Date(price.effectiveFrom), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
          },
          {
            key: 'effectiveUntil',
            label: copy('Effective until'),
            render: (price: Price) =>
              price.effectiveUntil
                ? formatDate(new Date(price.effectiveUntil), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : copy('Effective now'),
          },
          {
            key: 'cancelledAt',
            label: copy('Status'),
            render: (price: Price) => <Status value={price.cancelledAt ? 'CANCELLED' : 'ACTIVE'} />,
          },
        ]}
        data={prices}
        loading={loading}
        rowKey="id"
        emptyMessage={emptyMessage}
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
            .catch((error) => {
              if (!isSessionExpiredError(error))
                showToast({
                  variant: 'danger',
                  title: normalizeBackofficeApiError(error, copy('Could not cancel price.'))
                    .safeMessage,
                });
            });
        }}
        title={copy('Cancel price?')}
        message={copy('Price history is retained, but this price no longer applies.')}
        confirmLabel={copy('Cancel price')}
        variant="danger"
      />
    </>
  );
}

export function PriceChangeDialog({
  target,
  item,
  currency,
  prices,
  historyLoading,
  canCreate,
  canCancel,
  api,
  onClose,
  onSaved,
}: {
  target: 'default' | Variant | null;
  item: CatalogManagementItem;
  currency: string;
  prices: Price[];
  historyLoading: boolean;
  canCreate: boolean;
  canCancel: boolean;
  api: CatalogApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const { copy } = useCatalogLocalization();
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const variant = target && target !== 'default' ? target : null;
  const validEffectiveFrom = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(
    effectiveFrom,
  );

  const save = async () => {
    if (!target || !amount.trim() || !validEffectiveFrom) return;
    try {
      await api.changePrice({
        catalogItemId: item.id,
        catalogVariantId: variant?.id ?? null,
        locationId: null,
        currency,
        amount: amount.trim(),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      });
      onSaved();
      showToast({ variant: 'success', title: copy('Price updated.') });
      onClose();
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update price.')).safeMessage,
        });
    }
  };

  return (
    <DDialog
      open={Boolean(target)}
      onClose={onClose}
      title={variant ? `${copy('Variant price')} — ${variant.name}` : copy('Change default price')}
      description={
        variant
          ? copy('Variant prices are final prices, not differences from the default price.')
          : copy('A new price is added to effective history; the previous price is unchanged.')
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          {canCreate ? (
            <DButton onClick={() => void save()} disabled={!amount.trim() || !validEffectiveFrom}>
              {copy('Save price')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-5">
        {canCreate ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <DCurrencyInput
              label={copy('New price')}
              value={amount}
              onValueChange={setAmount}
              placeholder={copy('For example, 100000')}
            />
            <DDatePicker
              label={copy('Effective from')}
              value={effectiveFrom}
              onChange={setEffectiveFrom}
              variant="date-time"
              placeholder={copy('Select the date the price takes effect')}
            />
            <p className="text-sm text-[var(--color-text-muted)]">
              {copy('Currency:')} {currency}
            </p>
          </div>
        ) : null}
        <div className="border-t border-[var(--color-border)] pt-4">
          <h3 className="text-sm font-semibold">{copy('Price history')}</h3>
          {variant ? (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {copy(
                'Only variant-specific prices are recorded here. The item default price is not variant history.',
              )}
            </p>
          ) : null}
          <div className="mt-3">
            <PriceHistoryTable
              prices={prices}
              currency={currency}
              loading={historyLoading}
              canCancel={canCancel}
              onCancel={async (price) => {
                await api.cancelPrice(price.id);
                onSaved();
              }}
              emptyMessage={
                variant
                  ? copy('No variant-specific price history.')
                  : copy('No default price history.')
              }
            />
          </div>
        </div>
      </div>
    </DDialog>
  );
}
