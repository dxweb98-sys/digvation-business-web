import {
  DButton,
  DConfirmDialog,
  DCurrencyInput,
  DDataTable,
  DDatePicker,
  DDialog,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Ban, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type {
  CatalogApi,
  CatalogManagementItem,
  Category,
  DefaultPrice,
  Price,
  TaxCategory,
  Variant,
} from './catalog-api';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import {
  CatalogAccordion,
  DetailField,
  PriceLabel,
  Status,
  humanize,
} from './catalog-shared';

const keys = {
  prices: (itemId: string) => ['catalog', 'prices', itemId] as const,
  variants: (itemId: string) => ['catalog', 'variants', itemId] as const,
  variantPrice: (itemId: string, variantId: string, currency: string, effectiveAt: string) =>
    ['catalog', 'variant-price', itemId, variantId, currency, effectiveAt] as const,
};

export function CatalogItemDetailDialog({
  item,
  categories,
  taxCategories,
  defaultPrice,
  defaultPriceLoading,
  currency,
  effectiveAt,
  api,
  canCreate,
  canUpdate,
  canViewPricing,
  canCreatePricing,
  canCancelPricing,
  canViewTax,
  onPricingChanged,
  onVariantsChanged,
  onClose,
  onEdit,
}: {
  item: CatalogManagementItem | null;
  categories: Category[];
  taxCategories: TaxCategory[];
  defaultPrice: DefaultPrice | undefined;
  defaultPriceLoading: boolean;
  currency: string;
  effectiveAt: string;
  api: CatalogApi;
  canCreate: boolean;
  canUpdate: boolean;
  canViewPricing: boolean;
  canCreatePricing: boolean;
  canCancelPricing: boolean;
  canViewTax: boolean;
  onPricingChanged: () => void;
  onVariantsChanged: () => void;
  onClose: () => void;
  onEdit: (item: CatalogManagementItem) => void;
}) {
  const client = useQueryClient();
  const { copy } = useBackofficeLocalization();
  const [editingVariant, setEditingVariant] = useState<Variant | null | undefined>();
  const [pricingTarget, setPricingTarget] = useState<'default' | Variant | null>(null);
  const variants = useQuery({
    queryKey: keys.variants(item?.id ?? ''),
    queryFn: () => api.listVariants(item!.id),
    enabled: Boolean(item),
  });
  const priceHistory = useQuery({
    queryKey: keys.prices(item?.id ?? ''),
    queryFn: () => api.listPrices(item!.id),
    enabled: Boolean(item && canViewPricing),
  });
  const resolvedVariantPrices = useQueries({
    queries: (variants.data?.items ?? []).map((variant) => ({
      queryKey: keys.variantPrice(item?.id ?? '', variant.id, currency, effectiveAt),
      queryFn: () =>
        api.resolvePrice({
          catalogItemId: item!.id,
          catalogVariantId: variant.id,
          currency,
          effectiveAt,
        }),
      enabled: Boolean(item && canViewPricing),
    })),
  });
  if (!item) return null;

  const categoryName = item.categoryId
    ? (categories.find((category) => category.id === item.categoryId)?.name ?? item.categoryId)
    : copy('Not assigned');
  const taxCategoryName = item.taxCategoryId
    ? (taxCategories.find((category) => category.id === item.taxCategoryId)?.name ?? item.taxCategoryId)
    : copy('No item-specific tax');
  const serviceDefinition = item.serviceDefinition;
  const refreshVariants = () => void client.invalidateQueries({ queryKey: keys.variants(item.id) });
  const refreshVariantsAndCount = () => {
    refreshVariants();
    onVariantsChanged();
  };
  const defaultHistory = (priceHistory.data?.items ?? []).filter(
    (price) => price.catalogVariantId === null && price.locationId === null,
  );
  const variantPriceById = new Map(
    (variants.data?.items ?? []).map((variant, index) => [
      variant.id,
      resolvedVariantPrices[index],
    ]),
  );
  const variantColumns: TableColumn<Variant>[] = [
    { key: 'code', label: copy('Code') },
    { key: 'name', label: copy('Name') },
    ...(canViewPricing
      ? [
          {
            key: 'price',
            label: copy('Price'),
            render: (variant: Variant) => (
              <VariantPriceLabel
                query={variantPriceById.get(variant.id)}
                variantId={variant.id}
                currency={currency}
              />
            ),
          } as TableColumn<Variant>,
        ]
      : []),
    {
      key: 'status',
      label: copy('Status'),
      render: (variant) => <Status value={variant.status} />,
    },
  ];

  return (
    <DDialog
      open
      onClose={onClose}
      size="xl"
      title={item.name}
      description={`${item.code} · ${copy(humanize(item.type))}`}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
          {canUpdate ? (
            <DButton leftIcon={<Pencil className="size-4" />} onClick={() => onEdit(item)}>
              {copy('Edit item')}
            </DButton>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {copy('Item overview')}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">{item.name}</h2>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{item.code}</p>
            </div>
            <Status value={item.lifecycle} />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <DetailField label={copy('Type')} value={copy(humanize(item.type))} />
            <DetailField label={copy('Category')} value={categoryName} />
            <DetailField
              label={copy('Default Price')}
              value={
                <PriceLabel
                  price={defaultPrice}
                  loading={defaultPriceLoading}
                  available={canViewPricing}
                  emptyLabel={copy('Not set')}
                />
              }
              emphasized
            />
            <DetailField
              label={copy('Tax')}
              value={canViewTax ? taxCategoryName : '—'}
            />
            <DetailField label={copy('Variants')} value={item.variantCount} />
          </dl>
          <dl className="mt-4 grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
            <DetailField label={copy('Fulfillment')} value={copy(humanize(item.fulfillmentBehavior))} />
            <DetailField
              label={copy('Description')}
              value={item.description?.trim() || copy('No description')}
            />
          </dl>
          {canViewTax ? (
            <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
              {item.taxCategoryId
                ? copy('This item uses its assigned item tax category. Transaction tax may also apply when enabled.')
                : copy('No item-specific tax is assigned. Transaction tax may still apply when enabled.')}
            </p>
          ) : null}
        </section>

        {item.type === 'SERVICE' ? (
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
            <div>
              <h2 className="text-sm font-semibold">{copy('Service configuration')}</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {copy('Operational defaults used when this service is sold and fulfilled.')}
              </p>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField
                label={copy('Default duration')}
                value={
                  serviceDefinition?.defaultDurationMinutes != null
                    ? `${serviceDefinition.defaultDurationMinutes} ${copy('minutes')}`
                    : copy('Not configured')
                }
              />
              <DetailField
                label={copy('Employee assignment')}
                value={
                  serviceDefinition
                    ? copy(humanize(serviceDefinition.employeeAssignmentMode))
                    : copy('Not configured')
                }
              />
              <DetailField
                label={copy('Employee contribution')}
                value={
                  serviceDefinition?.allowEmployeeContribution
                    ? copy('Allowed')
                    : copy('Not allowed')
                }
              />
              <DetailField label={copy('Fulfillment')} value={copy(humanize(item.fulfillmentBehavior))} />
            </dl>
          </section>
        ) : null}

        <CatalogAccordion
          title={copy('Variants')}
          count={variants.data?.items.length ?? item.variantCount}
          description={copy('Open only when you need to review or maintain variant-specific configuration.')}
        >
          <div className="mb-3 flex justify-end">
            {canCreate ? (
              <DButton
                leftIcon={<Plus className="size-4" />}
                onClick={() => setEditingVariant(null)}
              >
                {copy('Add variant')}
              </DButton>
            ) : null}
          </div>
          <DDataTable
            columns={variantColumns}
            data={variants.data?.items ?? []}
            loading={variants.isLoading}
            rowKey="id"
            emptyMessage={copy('No variants.')}
            actions={[
              {
                label: copy('Edit variant'),
                icon: <Pencil className="size-4" />,
                onClick: setEditingVariant,
                show: () => canUpdate,
              },
              {
                label: copy('Manage variant price'),
                icon: <BadgeDollarSign className="size-4" />,
                onClick: setPricingTarget,
                show: () => canViewPricing,
              },
            ]}
          />
        </CatalogAccordion>

        {canViewPricing ? (
          <CatalogAccordion
            title={copy('Price history')}
            count={defaultHistory.length}
            description={copy('Historical default prices stay immutable so past sales remain auditable.')}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">{copy('Current default price')}</p>
                <p className="mt-1 text-lg font-semibold">
                  <PriceLabel
                    price={defaultPrice}
                    loading={defaultPriceLoading}
                    emptyLabel={copy('Not set')}
                  />
                </p>
              </div>
              {canCreatePricing ? (
                <DButton onClick={() => setPricingTarget('default')}>
                  {defaultPrice ? copy('Change price') : copy('Set price')}
                </DButton>
              ) : null}
            </div>
            <PriceHistoryTable
              prices={defaultHistory}
              currency={currency}
              loading={priceHistory.isLoading}
              canCancel={canCancelPricing}
              onCancel={async (price) => {
                await api.cancelPrice(price.id);
                onPricingChanged();
              }}
              emptyMessage={copy('No default price history.')}
            />
          </CatalogAccordion>
        ) : null}
      </div>

      <CatalogNamedRecordDialog
        key={`detail-variant-${editingVariant?.id ?? (editingVariant === null ? 'new' : 'closed')}`}
        entity="Variant"
        item={editingVariant}
        onClose={() => setEditingVariant(undefined)}
        onSave={async (existing, input) =>
          existing
            ? api.updateVariant(item.id, existing as Variant, input)
            : api.createVariant(item.id, input)
        }
        onSaved={refreshVariantsAndCount}
      />
      <PriceChangeDialog
        key={pricingTarget === 'default' ? 'default-price' : (pricingTarget?.id ?? 'closed')}
        target={pricingTarget}
        item={item}
        currency={currency}
        prices={
          pricingTarget === 'default'
            ? defaultHistory
            : pricingTarget
              ? (priceHistory.data?.items ?? []).filter(
                  (price) =>
                    price.catalogVariantId === pricingTarget.id && price.locationId === null,
                )
              : []
        }
        historyLoading={priceHistory.isLoading}
        canCreate={canCreatePricing}
        canCancel={canCancelPricing}
        api={api}
        onClose={() => setPricingTarget(null)}
        onSaved={onPricingChanged}
      />
    </DDialog>
  );
}

function VariantPriceLabel({
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
  const { copy, formatMoney } = useBackofficeLocalization();
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

function PriceHistoryTable({
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
  const { copy, formatDate, formatMoney } = useBackofficeLocalization();
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
          if (pending)
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

function PriceChangeDialog({
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
  const { copy } = useBackofficeLocalization();
  const [amount, setAmount] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() =>
    new Date().toISOString().slice(0, 16),
  );
  const variant = target && target !== 'default' ? target : null;
  const hasValidEffectiveFrom = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(
    effectiveFrom,
  );
  const save = async () => {
    if (!target || !amount.trim() || !hasValidEffectiveFrom) return;
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
            <DButton
              onClick={() => void save()}
              disabled={!amount.trim() || !hasValidEffectiveFrom}
            >
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
              {copy('Only variant-specific prices are recorded here. The item default price is not variant history.')}
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
