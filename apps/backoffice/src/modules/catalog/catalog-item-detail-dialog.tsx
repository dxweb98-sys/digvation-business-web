import {
  DAccordion,
  DAccordionItem,
  DBadge,
  DButton,
  DConfirmDialog,
  DDataTable,
  DDialog,
  type TableColumn,
} from '@digvation/ui';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeDollarSign, Pencil, Plus, Power, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type {
  CatalogApi,
  CatalogManagementItem,
  Category,
  DefaultPrice,
  TaxCategory,
  Variant,
} from './catalog-api';
import { CatalogItemThumbnail } from './catalog-item-thumbnail';
import { useCatalogLocalization } from './catalog-localization';
import { PriceChangeDialog, PriceHistoryTable, VariantPriceLabel } from './catalog-pricing';
import { CatalogNamedRecordDialog } from './catalog-record-dialog';
import { DetailField, PriceLabel, Status, humanize } from './catalog-shared';

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
  const { copy } = useCatalogLocalization();
  const [editingVariant, setEditingVariant] = useState<Variant | null | undefined>();
  const [pricingTarget, setPricingTarget] = useState<'default' | Variant | null>(null);
  const [statusTarget, setStatusTarget] = useState<Variant | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
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
    ? (categories.find((candidate) => candidate.id === item.categoryId)?.name ?? item.categoryId)
    : copy('Not assigned');
  const taxCategoryName = item.taxCategoryId
    ? (taxCategories.find((candidate) => candidate.id === item.taxCategoryId)?.name ?? item.taxCategoryId)
    : copy('No item-specific tax');
  const serviceDefinition = item.serviceDefinition;
  const defaultHistory = (priceHistory.data?.items ?? []).filter(
    (price) => price.catalogVariantId === null && price.locationId === null,
  );
  const variantPriceById = new Map(
    (variants.data?.items ?? []).map((variant, index) => [variant.id, resolvedVariantPrices[index]]),
  );
  const refreshVariants = () =>
    void client.invalidateQueries({ queryKey: keys.variants(item.id) });
  const refreshVariantsAndCount = () => {
    refreshVariants();
    onVariantsChanged();
  };
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

  const confirmVariantStatus = async () => {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true);
    try {
      await api.updateVariant(item.id, statusTarget, {
        status: statusTarget.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      });
      setStatusTarget(null);
      refreshVariantsAndCount();
      void client.invalidateQueries({ queryKey: ['catalog', 'default-prices'] });
    } finally {
      setChangingStatus(false);
    }
  };

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
          <div className="grid gap-5 md:grid-cols-[auto_minmax(0,1fr)]">
            <CatalogItemThumbnail api={api} itemId={item.id} itemName={item.name} size="detail" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    {copy('Item overview')}
                  </p>
                  <h2 className="mt-1 break-words text-xl font-semibold tracking-tight">{item.name}</h2>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{item.code}</p>
                </div>
                <Status value={item.lifecycle} />
              </div>
              <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <DetailField label={copy('Tax')} value={canViewTax ? taxCategoryName : '—'} />
                <DetailField label={copy('Category')} value={categoryName} />
                <DetailField label={copy('Variants')} value={item.variantCount} />
              </dl>
            </div>
          </div>

          <dl className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label={copy('Type')} value={copy(humanize(item.type))} />
            <DetailField
              label={copy('Fulfillment')}
              value={copy(humanize(item.fulfillmentBehavior))}
            />
            <div className="sm:col-span-2">
              <DetailField
                label={copy('Description')}
                value={item.description?.trim() || copy('No description')}
              />
            </div>
          </dl>
          {canViewTax ? (
            <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-5 text-[var(--color-text-muted)]">
              {item.taxCategoryId
                ? copy(
                    'This item uses its assigned item tax category. Transaction tax may also apply when enabled.',
                  )
                : copy(
                    'No item-specific tax is assigned. Transaction tax may still apply when enabled.',
                  )}
            </p>
          ) : null}
        </section>

        {item.type === 'SERVICE' ? (
          <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
            <h2 className="text-sm font-semibold">{copy('Service configuration')}</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {copy('Operational defaults used when this service is sold and fulfilled.')}
            </p>
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
              <DetailField
                label={copy('Fulfillment')}
                value={copy(humanize(item.fulfillmentBehavior))}
              />
            </dl>
          </section>
        ) : null}

        <DAccordion type="multiple" variant="separated">
          <DAccordionItem
            value="variants"
            title={
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{copy('Variants')}</span>
                  <DBadge variant="secondary">
                    {variants.data?.items.length ?? item.variantCount}
                  </DBadge>
                </span>
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  {copy(
                    'Open only when you need to review or maintain variant-specific configuration.',
                  )}
                </span>
              </span>
            }
          >
            <div className="mb-3 flex justify-end">
              {canCreate ? (
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditingVariant(null)}>
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
                {
                  label: copy('Deactivate variant'),
                  icon: <Power className="size-4" />,
                  onClick: setStatusTarget,
                  show: (variant) => canUpdate && variant.status === 'ACTIVE',
                },
                {
                  label: copy('Reactivate variant'),
                  icon: <RotateCcw className="size-4" />,
                  onClick: setStatusTarget,
                  show: (variant) => canUpdate && variant.status === 'INACTIVE',
                },
              ]}
            />
          </DAccordionItem>

          {canViewPricing ? (
            <DAccordionItem
              value="price-history"
              title={
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{copy('Price history')}</span>
                    <DBadge variant="secondary">{defaultHistory.length}</DBadge>
                  </span>
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">
                    {copy(
                      'Historical default prices stay immutable so past sales remain auditable.',
                    )}
                  </span>
                </span>
              }
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-muted)] p-3">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {copy('Current default price')}
                  </p>
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
            </DAccordionItem>
          ) : null}
        </DAccordion>
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
      <DConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void confirmVariantStatus()}
        loading={changingStatus}
        variant={statusTarget?.status === 'ACTIVE' ? 'danger' : 'primary'}
        title={
          statusTarget?.status === 'ACTIVE'
            ? copy('Deactivate variant?')
            : copy('Reactivate variant?')
        }
        message={
          statusTarget?.status === 'ACTIVE'
            ? copy('This variant will stop appearing in active selling choices. Existing transaction and price history will be preserved.')
            : copy('This variant will become available for active selling choices again.')
        }
        confirmLabel={
          statusTarget?.status === 'ACTIVE'
            ? copy('Deactivate variant')
            : copy('Reactivate variant')
        }
      />
    </DDialog>
  );
}
