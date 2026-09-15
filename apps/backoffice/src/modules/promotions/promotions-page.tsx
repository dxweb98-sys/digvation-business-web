import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DDataTable,
  DDatePicker,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DToggle,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import {
  PromotionsApi,
  type Promotion,
  type PromotionDiscountType,
  type PromotionMode,
  type PromotionReferenceOption,
  type PromotionReferenceOptions,
  type PromotionScope,
  type PromotionWriteInput,
} from './promotions-api';
import { usePromotionsLocalization } from './promotions-localization';

const keys = {
  list: ['promotions', 'list'] as const,
  options: ['promotions', 'options'] as const,
};

type CategoryItemScope = 'ALL' | 'SELECTED';

function percentageDisplay(value: string) {
  const amount = Number(value) * 100;
  return Number.isFinite(amount) ? `${amount.toLocaleString()}%` : value;
}

export function PromotionsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const promotionCopy = usePromotionsLocalization();
  const { formatDate } = useBackofficeLocalization();
  const api = useMemo(
    () => new PromotionsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const [editing, setEditing] = useState<Promotion | null | undefined>(undefined);

  const canCreate = Boolean(session && canPerformBackofficeAction(session, 'createPromotion'));
  const canUpdate = Boolean(session && canPerformBackofficeAction(session, 'updatePromotion'));

  const promotions = useQuery({
    queryKey: keys.list,
    queryFn: () => api.list(),
  });
  const options = useQuery({
    queryKey: keys.options,
    queryFn: () => api.options(),
  });

  if (!session) return null;

  const columns: TableColumn<Promotion>[] = [
    {
      key: 'name',
      label: promotionCopy('name'),
      render: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[var(--color-text)]">{row.name}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {row.mode === 'CODE' ? row.code : promotionCopy('automatic')}
          </p>
        </div>
      ),
    },
    {
      key: 'scope',
      label: promotionCopy('scope'),
      render: (row) =>
        promotionCopy(row.scope.toLowerCase() as 'item' | 'category' | 'transaction'),
    },
    {
      key: 'discountValue',
      label: promotionCopy('discount'),
      render: (row) =>
        row.discountType === 'PERCENTAGE'
          ? percentageDisplay(row.discountValue)
          : `${row.currency ?? ''} ${row.discountValue}`.trim(),
    },
    {
      key: 'itemIds',
      label: promotionCopy('targetSummary'),
      render: (row) => {
        if (row.scope === 'TRANSACTION') return promotionCopy('transaction');
        if (row.scope === 'CATEGORY' && row.itemIds.length > 0) {
          return `${row.categoryIds.length} ${promotionCopy('category')} · ${row.itemIds.length} ${promotionCopy('item')}`;
        }
        const count = row.scope === 'ITEM' ? row.itemIds.length : row.categoryIds.length;
        return `${count} ${promotionCopy('selected')}`;
      },
    },
    {
      key: 'effectiveFrom',
      label: promotionCopy('effectivity'),
      render: (row) => {
        const from = row.effectiveFrom
          ? formatDate(new Date(row.effectiveFrom), { dateStyle: 'medium' })
          : promotionCopy('immediate');
        const until = row.effectiveUntil
          ? formatDate(new Date(row.effectiveUntil), { dateStyle: 'medium' })
          : promotionCopy('noEnd');
        return `${from} → ${until}`;
      },
    },
    {
      key: 'status',
      label: promotionCopy('status'),
      render: (row) => (
        <DBadge variant={row.status === 'ACTIVE' ? 'success' : 'secondary'}>
          {promotionCopy(
            row.status === 'ACTIVE'
              ? 'active'
              : row.status === 'SCHEDULED'
                ? 'scheduled'
                : row.status === 'EXPIRED'
                  ? 'expired'
                  : 'disabled',
          )}
        </DBadge>
      ),
    },
  ];

  const loading = promotions.isLoading || options.isLoading;
  const referenceOptions = options.data ?? { items: [], categories: [], locations: [] };

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={promotionCopy('title')}
        title={promotionCopy('title')}
        description={promotionCopy('description')}
      />

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <DSkeleton className="h-12 w-full" />
            <DSkeleton className="h-16 w-full" />
            <DSkeleton className="h-16 w-full" />
          </div>
        ) : (
          <DDataTable
            columns={columns}
            data={promotions.data?.items ?? []}
            rowKey="id"
            emptyMessage={promotionCopy('empty')}
            headerActions={
              canCreate ? (
                <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
                  {promotionCopy('add')}
                </DButton>
              ) : null
            }
            actions={
              canUpdate
                ? [
                    {
                      label: promotionCopy('edit'),
                      icon: <Pencil className="size-4" />,
                      onClick: (row) => setEditing(row),
                    },
                  ]
                : []
            }
          />
        )}
      </div>

      {editing !== undefined ? (
        <PromotionDialog
          promotion={editing}
          options={referenceOptions}
          api={api}
          onClose={() => setEditing(undefined)}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: keys.list });
          }}
        />
      ) : null}
    </BackofficePage>
  );
}

function PromotionDialog({
  promotion,
  options,
  api,
  onClose,
  onChanged,
}: {
  promotion: Promotion | null;
  options: PromotionReferenceOptions;
  api: PromotionsApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const copy = usePromotionsLocalization();
  const { showToast } = useToast();
  const [name, setName] = useState(promotion?.name ?? '');
  const [enabled, setEnabled] = useState(promotion?.enabled ?? true);
  const [mode, setMode] = useState<PromotionMode>(promotion?.mode ?? 'AUTOMATIC');
  const [code, setCode] = useState(promotion?.code ?? '');
  const [scope, setScope] = useState<PromotionScope>(promotion?.scope ?? 'TRANSACTION');
  const [discountType, setDiscountType] = useState<PromotionDiscountType>(
    promotion?.discountType ?? 'PERCENTAGE',
  );
  const [discountValue, setDiscountValue] = useState(
    promotion?.discountType === 'PERCENTAGE'
      ? String(Number(promotion.discountValue) * 100)
      : (promotion?.discountValue ?? ''),
  );
  const [currency, setCurrency] = useState(promotion?.currency ?? 'IDR');
  const [maximumDiscount, setMaximumDiscount] = useState(promotion?.maximumDiscount ?? '');
  const [minimumPurchase, setMinimumPurchase] = useState(promotion?.minimumPurchase ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(promotion?.effectiveFrom ?? '');
  const [effectiveUntil, setEffectiveUntil] = useState(promotion?.effectiveUntil ?? '');
  const [itemIds, setItemIds] = useState<string[]>(promotion?.itemIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(promotion?.categoryIds ?? []);
  const [categoryItemScope, setCategoryItemScope] = useState<CategoryItemScope>(
    promotion?.scope === 'CATEGORY' && promotion.itemIds.length > 0 ? 'SELECTED' : 'ALL',
  );
  const [locationIds, setLocationIds] = useState<string[]>(promotion?.locationIds ?? []);
  const [saving, setSaving] = useState(false);

  const categoryItemOptions = useMemo(() => {
    const selectedCategories = new Set(categoryIds);
    return options.items.filter(
      (option) => option.categoryId && selectedCategories.has(option.categoryId),
    );
  }, [categoryIds, options.items]);

  const numericValue = Number(discountValue);
  const numericMaximum = maximumDiscount ? Number(maximumDiscount) : null;
  const numericMinimum = minimumPurchase ? Number(minimumPurchase) : null;
  const needsCurrency =
    discountType === 'FIXED_AMOUNT' || maximumDiscount !== '' || minimumPurchase !== '';
  const currencyValid = !needsCurrency || /^[A-Z]{3}$/.test(currency.trim().toUpperCase());
  const targetValid =
    scope === 'TRANSACTION' ||
    (scope === 'ITEM' && itemIds.length > 0) ||
    (scope === 'CATEGORY' &&
      categoryIds.length > 0 &&
      (categoryItemScope === 'ALL' || itemIds.length > 0));
  const valueValid =
    Number.isFinite(numericValue) &&
    numericValue > 0 &&
    (discountType === 'FIXED_AMOUNT' || numericValue <= 100);
  const maximumValid =
    numericMaximum === null ||
    (discountType === 'PERCENTAGE' && Number.isFinite(numericMaximum) && numericMaximum > 0);
  const minimumValid =
    numericMinimum === null || (Number.isFinite(numericMinimum) && numericMinimum >= 0);
  const periodValid =
    !effectiveFrom ||
    !effectiveUntil ||
    new Date(effectiveUntil).getTime() > new Date(effectiveFrom).getTime();
  const valid =
    name.trim().length > 0 &&
    (mode === 'AUTOMATIC' || code.trim().length > 0) &&
    valueValid &&
    maximumValid &&
    minimumValid &&
    currencyValid &&
    targetValid &&
    periodValid;

  const changeScope = (value: PromotionScope) => {
    setScope(value);
    if (value === 'TRANSACTION') {
      setItemIds([]);
      setCategoryIds([]);
      setCategoryItemScope('ALL');
    } else if (value === 'ITEM') {
      setCategoryIds([]);
      setCategoryItemScope('ALL');
    } else {
      setItemIds([]);
      setCategoryItemScope('ALL');
    }
  };

  const changeCategories = (ids: string[]) => {
    setCategoryIds(ids);
    const selectedCategories = new Set(ids);
    setItemIds((current) =>
      current.filter((itemId) => {
        const option = options.items.find((item) => item.id === itemId);
        return Boolean(option?.categoryId && selectedCategories.has(option.categoryId));
      }),
    );
  };

  const changeCategoryItemScope = (value: CategoryItemScope) => {
    setCategoryItemScope(value);
    if (value === 'ALL') setItemIds([]);
  };

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const input: PromotionWriteInput = {
      name: name.trim(),
      enabled,
      mode,
      code: mode === 'CODE' ? code.trim().toUpperCase() : null,
      scope,
      discountType,
      discountValue:
        discountType === 'PERCENTAGE' ? String(numericValue / 100) : discountValue.trim(),
      currency: currency.trim() ? currency.trim().toUpperCase() : null,
      maximumDiscount: maximumDiscount.trim() || null,
      minimumPurchase: minimumPurchase.trim() || null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      itemIds:
        scope === 'ITEM' || (scope === 'CATEGORY' && categoryItemScope === 'SELECTED')
          ? itemIds
          : [],
      categoryIds: scope === 'CATEGORY' ? categoryIds : [],
      locationIds,
    };
    try {
      if (promotion) await api.update(promotion, input);
      else await api.create(input);
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('saved') });
    } catch (error) {
      if (!isSessionExpiredError(error)) {
        const normalized = normalizeBackofficeApiError(error);
        const title =
          normalized.code === 'FORBIDDEN' || normalized.status === 403
            ? copy('forbidden')
            : normalized.status !== null && normalized.status >= 500
              ? copy('serverError')
              : normalized.safeMessage || copy('saveFailed');
        showToast({ variant: 'danger', title });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open
      onClose={onClose}
      title={promotion ? copy('edit') : copy('add')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('cancel')}
          </DButton>
          <DButton onClick={() => void save()} disabled={!valid || saving} loading={saving}>
            {copy('save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <DInput label={copy('name')} value={name} onChange={setName} />
        </div>
        <DSelect
          label={copy('mode')}
          value={mode}
          clearable={false}
          options={[
            { value: 'AUTOMATIC', label: copy('automatic') },
            { value: 'CODE', label: copy('code') },
          ]}
          onValueChange={(value) => {
            const next = value as PromotionMode;
            setMode(next);
            if (next === 'AUTOMATIC') setCode('');
          }}
        />
        {mode === 'CODE' ? (
          <DInput
            label={copy('codeLabel')}
            value={code}
            onChange={(value) => setCode(value.toUpperCase())}
            placeholder="WELCOME10"
          />
        ) : (
          <div className="flex items-end justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5">
            <span className="text-sm font-medium">{copy('enabled')}</span>
            <DToggle checked={enabled} onChange={setEnabled} ariaLabel={copy('enabled')} />
          </div>
        )}
        {mode === 'CODE' ? (
          <div className="flex items-end justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-2.5 sm:col-span-2">
            <span className="text-sm font-medium">{copy('enabled')}</span>
            <DToggle checked={enabled} onChange={setEnabled} ariaLabel={copy('enabled')} />
          </div>
        ) : null}

        <DSelect
          label={copy('scope')}
          value={scope}
          clearable={false}
          options={[
            { value: 'TRANSACTION', label: copy('transaction') },
            { value: 'ITEM', label: copy('item') },
            { value: 'CATEGORY', label: copy('category') },
          ]}
          onValueChange={(value) => changeScope(value as PromotionScope)}
        />
        <DSelect
          label={copy('discountType')}
          value={discountType}
          clearable={false}
          options={[
            { value: 'PERCENTAGE', label: copy('percentage') },
            { value: 'FIXED_AMOUNT', label: copy('fixed') },
          ]}
          onValueChange={(value) => {
            const next = value as PromotionDiscountType;
            setDiscountType(next);
            if (next === 'FIXED_AMOUNT') setMaximumDiscount('');
          }}
        />

        <div>
          <DInput
            label={copy('value')}
            inputMode="decimal"
            value={discountValue}
            onChange={setDiscountValue}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {copy(discountType === 'PERCENTAGE' ? 'percentageHint' : 'fixedHint')}
          </p>
        </div>
        <div>
          <DInput
            label={`${copy('currency')} (${needsCurrency ? copy('enabled') : copy('optional')})`}
            value={currency}
            maxLength={3}
            onChange={(value) => setCurrency(value.toUpperCase())}
            placeholder="IDR"
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{copy('currencyHint')}</p>
        </div>

        {discountType === 'PERCENTAGE' ? (
          <DInput
            label={`${copy('maximum')} (${copy('optional')})`}
            inputMode="decimal"
            value={maximumDiscount}
            onChange={setMaximumDiscount}
          />
        ) : null}
        <DInput
          label={`${copy('minimum')} (${copy('optional')})`}
          inputMode="decimal"
          value={minimumPurchase}
          onChange={setMinimumPurchase}
        />

        <DDatePicker
          label={`${copy('effectiveFrom')} (${copy('optional')})`}
          variant="date-time"
          value={effectiveFrom}
          onChange={(value) => setEffectiveFrom(value == null ? '' : String(value))}
          onClear={() => setEffectiveFrom('')}
          clearable
        />
        <DDatePicker
          label={`${copy('effectiveUntil')} (${copy('optional')})`}
          variant="date-time"
          value={effectiveUntil}
          onChange={(value) => setEffectiveUntil(value == null ? '' : String(value))}
          onClear={() => setEffectiveUntil('')}
          clearable
          error={periodValid ? undefined : copy('invalid')}
        />
      </div>

      {scope === 'ITEM' ? (
        <TargetSelector
          className="mt-5"
          label={copy('targets')}
          options={options.items}
          selected={itemIds}
          onChange={setItemIds}
          emptyLabel={copy('noOptions')}
        />
      ) : null}

      {scope === 'CATEGORY' ? (
        <div className="mt-5 space-y-4">
          <TargetSelector
            label={copy('targets')}
            options={options.categories}
            selected={categoryIds}
            onChange={changeCategories}
            emptyLabel={copy('noOptions')}
          />

          <DSelect
            label={copy('categoryItemScope')}
            value={categoryItemScope}
            clearable={false}
            options={[
              { value: 'ALL', label: copy('allCategoryItems') },
              { value: 'SELECTED', label: copy('selectedCategoryItems') },
            ]}
            onValueChange={(value) => changeCategoryItemScope(value as CategoryItemScope)}
          />

          {categoryItemScope === 'SELECTED' ? (
            <TargetSelector
              label={copy('selectCategoryItems')}
              options={categoryItemOptions}
              selected={itemIds}
              onChange={setItemIds}
              emptyLabel={copy('noCategoryItems')}
            />
          ) : null}
        </div>
      ) : null}

      <TargetSelector
        className="mt-5"
        label={`${copy('locations')} · ${locationIds.length ? `${locationIds.length} ${copy('selected')}` : copy('allLocations')}`}
        options={options.locations}
        selected={locationIds}
        onChange={setLocationIds}
        emptyLabel={copy('noOptions')}
      />
    </DDialog>
  );
}

function TargetSelector({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
  className = '',
}: {
  label: string;
  options: PromotionReferenceOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyLabel: string;
  className?: string;
}) {
  const selectedSet = new Set(selected);
  const toggle = (id: string) => {
    onChange(selectedSet.has(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  };

  return (
    <fieldset className={className}>
      <legend className="mb-2 text-sm font-medium text-[var(--color-text)]">{label}</legend>
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        {options.length ? (
          options.map((option) => {
            const active = selectedSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={[
                  'flex w-full items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors',
                  active
                    ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                    : 'hover:bg-[var(--color-surface-muted)] text-[var(--color-text)]',
                ].join(' ')}
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{option.name}</span>
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">{option.code}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold">{active ? '✓' : ''}</span>
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
        )}
      </div>
    </fieldset>
  );
}
