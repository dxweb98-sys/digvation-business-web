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
import {
  Check,
  ChevronRight,
  Info,
  List,
  LockKeyhole,
  Pencil,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
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

export type PromotionCopy = (
  key: 'transaction' | 'category' | 'item' | 'variants' | 'selected',
) => string;

export function promotionTargetSummary(row: Promotion, copy: PromotionCopy) {
  if (row.scope === 'TRANSACTION') return copy('transaction');
  if (row.scope === 'CATEGORY' && row.itemIds.length > 0) {
    return `${row.categoryIds.length} ${copy('category')} · ${row.itemIds.length} ${copy('item')}`;
  }
  if (row.scope === 'ITEM') {
    const targets = [
      row.itemIds.length ? `${row.itemIds.length} ${copy('item')}` : null,
      row.variantIds.length ? `${row.variantIds.length} ${copy('variants')}` : null,
    ].filter((value): value is string => value !== null);
    return targets.join(' · ') || `0 ${copy('selected')}`;
  }
  return `${row.categoryIds.length} ${copy('selected')}`;
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
      render: (row) => promotionTargetSummary(row, promotionCopy),
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
  const referenceOptions = options.data ?? {
    items: [],
    variants: [],
    categories: [],
    locations: [],
  };

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
  const [currency] = useState(promotion?.currency ?? 'IDR');
  const [maximumDiscount, setMaximumDiscount] = useState(promotion?.maximumDiscount ?? '');
  const [minimumPurchase, setMinimumPurchase] = useState(promotion?.minimumPurchase ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(promotion?.effectiveFrom ?? '');
  const [effectiveUntil, setEffectiveUntil] = useState(promotion?.effectiveUntil ?? '');
  const [itemIds, setItemIds] = useState<string[]>(promotion?.itemIds ?? []);
  const [variantIds, setVariantIds] = useState<string[]>(promotion?.variantIds ?? []);
  const [categoryIds, setCategoryIds] = useState<string[]>(promotion?.categoryIds ?? []);
  const [categoryItemScope, setCategoryItemScope] = useState<CategoryItemScope>(
    promotion?.scope === 'CATEGORY' && promotion.itemIds.length > 0 ? 'SELECTED' : 'ALL',
  );
  const [locationIds, setLocationIds] = useState<string[]>(promotion?.locationIds ?? []);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'INFORMATION' | 'TARGET'>('INFORMATION');
  const [showAllItemTargets, setShowAllItemTargets] = useState(promotion === null);

  const categoryItemOptions = useMemo(() => {
    const selectedCategories = new Set(categoryIds);
    return options.items.filter(
      (option) => option.categoryId && selectedCategories.has(option.categoryId),
    );
  }, [categoryIds, options.items]);

  const selectedItemGroups = useMemo(() => {
    const parentIds = new Set(itemIds);
    for (const variant of options.variants) {
      if (variantIds.includes(variant.id) && variant.catalogItemId) {
        parentIds.add(variant.catalogItemId);
      }
    }
    return parentIds;
  }, [itemIds, options.variants, variantIds]);

  const visibleItemTargets = useMemo(
    () =>
      showAllItemTargets
        ? options.items
        : options.items.filter((item) => selectedItemGroups.has(item.id)),
    [options.items, selectedItemGroups, showAllItemTargets],
  );

  const numericValue = Number(discountValue);
  const numericMaximum = maximumDiscount ? Number(maximumDiscount) : null;
  const numericMinimum = minimumPurchase ? Number(minimumPurchase) : null;
  const needsCurrency =
    discountType === 'FIXED_AMOUNT' || maximumDiscount !== '' || minimumPurchase !== '';
  const currencyValid = !needsCurrency || /^[A-Z]{3}$/.test(currency.trim().toUpperCase());
  const targetValid =
    scope === 'TRANSACTION' ||
    (scope === 'ITEM' && (itemIds.length > 0 || variantIds.length > 0)) ||
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
      setVariantIds([]);
      setCategoryIds([]);
      setCategoryItemScope('ALL');
    } else if (value === 'ITEM') {
      setCategoryIds([]);
      setCategoryItemScope('ALL');
    } else {
      setItemIds([]);
      setVariantIds([]);
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
      variantIds: scope === 'ITEM' ? variantIds : [],
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

  const targetStepSummary =
    scope === 'TRANSACTION'
      ? copy('allItems')
      : scope === 'CATEGORY'
        ? String(categoryIds.length) + ' ' + copy('category')
        : selectedItemGroups.size > 0
          ? String(selectedItemGroups.size) + ' ' + copy('activeShort')
          : copy('allItems');

  return (
    <DDialog
      open
      onClose={onClose}
      title={
        <span className="flex w-full items-center justify-between gap-3">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
            <span>{promotion ? copy('edit') : copy('add')}</span>
            {!promotion ? (
              <span className="rounded-md border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[.06] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
                {copy('newBadge')}
              </span>
            ) : promotion.code ? (
              <span className="rounded-md border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[.06] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-brand)]">
                {promotion.code}
              </span>
            ) : null}
            {promotion ? (
              <span
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'size-1.5 rounded-full',
                    enabled ? 'bg-emerald-500' : 'bg-[var(--color-text-muted)]',
                  ].join(' ')}
                />
                {enabled ? copy('active') : copy('disabled')}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label={copy('cancel')}
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/20"
          >
            <X className="size-4" />
          </button>
        </span>
      }
      description={
        <span className="block">
          <span className="block">{copy('description')}</span>
          <span className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              aria-pressed={step === 'INFORMATION'}
              onClick={() => setStep('INFORMATION')}
              className={[
                'flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all',
                step === 'INFORMATION'
                  ? 'border border-slate-200 bg-white text-[var(--color-brand)] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <Info className="size-3.5" />
              <span>{copy('informationStep')}</span>
            </button>
            <button
              type="button"
              aria-pressed={step === 'TARGET'}
              onClick={() => setStep('TARGET')}
              className={[
                'flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all',
                step === 'TARGET'
                  ? 'border border-slate-200 bg-white text-[var(--color-brand)] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <List className="size-3.5" />
              <span>{copy('targetStep')}</span>
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                  step === 'TARGET'
                    ? 'bg-blue-50 text-[var(--color-brand)]'
                    : 'text-slate-400',
                ].join(' ')}
              >
                {targetStepSummary}
              </span>
            </button>
          </span>
        </span>
      }
      size="md"
      showClose={false}
      overlayClassName="bg-slate-900/40"
      className="sm:max-h-[calc(100vh-24px)] sm:max-w-[540px] sm:rounded-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            {promotion ? (
              <DButton
                variant="outline"
                size="sm"
                disabled
                title={copy('deleteUnavailable')}
                className="border-[var(--color-danger)]/35 text-[var(--color-danger)]"
                leftIcon={<Trash2 className="size-3.5" />}
              >
                {copy('deletePromotion')}
              </DButton>
            ) : (
              <span className="text-[11px] font-medium text-[var(--color-danger)]">
                {copy('requiredHint')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DButton size="sm" variant="secondary" onClick={onClose}>
              {copy('cancel')}
            </DButton>
            <DButton
              size="sm"
              leftIcon={<Check className="size-3.5" />}
              onClick={() => void save()}
              disabled={!valid || saving}
              loading={saving}
            >
              {promotion ? copy('saveChanges') : copy('savePromotion')}
            </DButton>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-[500px] space-y-5">
        {step === 'INFORMATION' ? (
          <div className="space-y-4">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-blue-50 text-[var(--color-brand)]">
                    <Info className="size-3" />
                  </span>
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    {copy('promotionInfo')}
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400">{copy('cashierVisibility')}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <DInput
                    size="sm"
                    clearable={false}
                    label={copy('name') + ' *'}
                    value={name}
                    onChange={setName}
                    placeholder={copy('namePlaceholder')}
                  />
                </div>

                <DSelect
                  size="sm"
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

                <DInput
                  size="sm"
                  clearable={false}
                  label={copy('codeLabel')}
                  value={code}
                  readOnly={mode === 'AUTOMATIC'}
                  className={mode === 'AUTOMATIC' ? 'read-only:bg-white read-only:text-slate-400' : undefined}
                  onChange={(value) => setCode(value.toUpperCase())}
                  placeholder={mode === 'AUTOMATIC' ? copy('automaticCodeHint') : 'SEP10'}
                />

                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold">{copy('operationalStatus')}</p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      {copy('operationalStatusHint')}
                    </p>
                  </div>
                  <DToggle checked={enabled} onChange={setEnabled} ariaLabel={copy('enabled')} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="grid size-5 place-items-center rounded-full bg-blue-50 text-[var(--color-brand)]">
                  <Tag className="size-3" />
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  {copy('termsAndDiscount')}
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={discountType === 'PERCENTAGE'}
                  onClick={() => setDiscountType('PERCENTAGE')}
                  className={[
                    'min-h-[72px] rounded-xl border px-3 py-2.5 text-left transition-all',
                    discountType === 'PERCENTAGE'
                      ? 'border-2 border-[var(--color-brand)] bg-blue-50/30'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/35',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                        discountType === 'PERCENTAGE'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-border)]',
                      ].join(' ')}
                    >
                      {discountType === 'PERCENTAGE' ? <Check className="size-2.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold">{copy('percentageCard')}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-[var(--color-text-muted)]">
                        {copy('percentageCardHint')}
                      </span>
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={discountType === 'FIXED_AMOUNT'}
                  onClick={() => {
                    setDiscountType('FIXED_AMOUNT');
                    setMaximumDiscount('');
                  }}
                  className={[
                    'min-h-[72px] rounded-xl border px-3 py-2.5 text-left transition-all',
                    discountType === 'FIXED_AMOUNT'
                      ? 'border-2 border-[var(--color-brand)] bg-blue-50/30'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/35',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                        discountType === 'FIXED_AMOUNT'
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                          : 'border-[var(--color-border)]',
                      ].join(' ')}
                    >
                      {discountType === 'FIXED_AMOUNT' ? <Check className="size-2.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold">{copy('fixedCard')}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-[var(--color-text-muted)]">
                        {copy('fixedCardHint')}
                      </span>
                    </span>
                  </div>
                </button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <DInput
                    size="sm"
                    clearable={false}
                    label={copy('value') + ' *'}
                    inputMode="decimal"
                    value={discountValue}
                    prefix={discountType === 'FIXED_AMOUNT' ? 'Rp' : undefined}
                    suffix={discountType === 'PERCENTAGE' ? '%' : undefined}
                    onChange={setDiscountValue}
                  />
                  <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                    {copy(discountType === 'PERCENTAGE' ? 'percentageHint' : 'fixedHint')}
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-xs font-medium text-[var(--color-text)]">
                    {copy('currency')}
                  </label>
                  <div
                    aria-label={copy('currencyLocked')}
                    className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-[var(--radius-control)] border border-slate-200 bg-slate-100/80 px-3"
                  >
                    <span className="truncate text-xs font-semibold text-slate-700">
                      {currency === 'IDR' ? 'IDR (Rupiah)' : currency}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                      <LockKeyhole className="size-2.5" />
                      {copy('defaultLocked')}
                    </span>
                  </div>
                </div>

                {discountType === 'PERCENTAGE' ? (
                  <DInput
                    size="sm"
                    clearable={false}
                    prefix="Rp"
                    label={
                      <span>
                        {copy('maximum')}{' '}
                        <span className="font-normal text-[var(--color-text-muted)]">
                          ({copy('optional')})
                        </span>
                      </span>
                    }
                    inputMode="decimal"
                    value={maximumDiscount}
                    placeholder={copy('maximumPlaceholder')}
                    onChange={setMaximumDiscount}
                  />
                ) : (
                  <div />
                )}

                <DInput
                  size="sm"
                  clearable={false}
                  prefix="Rp"
                  label={
                    <span>
                      {copy('minimum')}{' '}
                      <span className="font-normal text-[var(--color-text-muted)]">
                        ({copy('optional')})
                      </span>
                    </span>
                  }
                  inputMode="decimal"
                  value={minimumPurchase}
                  placeholder={copy('minimumPlaceholder')}
                  onChange={setMinimumPurchase}
                />

                <DDatePicker
                  label={copy('effectiveFrom') + ' (' + copy('optional') + ')'}
                  variant="date-time"
                  value={effectiveFrom}
                  onChange={(value) => setEffectiveFrom(value == null ? '' : String(value))}
                  onClear={() => setEffectiveFrom('')}
                  clearable
                />
                <DDatePicker
                  label={copy('effectiveUntil') + ' (' + copy('optional') + ')'}
                  variant="date-time"
                  value={effectiveUntil}
                  onChange={(value) => setEffectiveUntil(value == null ? '' : String(value))}
                  onClear={() => setEffectiveUntil('')}
                  clearable
                  error={periodValid ? undefined : copy('invalid')}
                />
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-xs font-semibold text-slate-700">{copy('scopePromo')}</h3>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  {
                    value: 'TRANSACTION' as const,
                    title: copy('allTransactions'),
                    hint: copy('allTransactionsHint'),
                  },
                  {
                    value: 'CATEGORY' as const,
                    title: copy('perCategory'),
                    hint: copy('perCategoryHint'),
                  },
                  {
                    value: 'ITEM' as const,
                    title: copy('perItemVariant'),
                    hint: copy('perItemVariantHint'),
                  },
                ].map((option) => {
                  const active = scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => changeScope(option.value)}
                      className={[
                        'flex min-h-[68px] flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all',
                        active
                          ? 'border-2 border-[var(--color-brand)] bg-blue-50/30 text-[var(--color-brand)]'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-[var(--color-brand)]/35',
                      ].join(' ')}
                    >
                      <span className="block text-xs font-semibold">{option.title}</span>
                      <span
                        className={[
                          'mt-1 block text-[10px]',
                          active ? 'text-[var(--color-brand)]/80' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {scope === 'ITEM' ? (
              <section>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold">
                      {copy('targetItems')}
                      <span className="ml-2 text-[10px] font-medium text-[var(--color-text-muted)]">
                        {selectedItemGroups.size} {copy('selectedActive')}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                      {copy('targetWorkspaceHint')}
                    </p>
                  </div>
                  <DButton
                    size="sm"
                    variant="ghost"
                    className="text-[var(--color-brand)]"
                    leftIcon={<Plus className="size-3.5" />}
                    onClick={() => setShowAllItemTargets(true)}
                    disabled={showAllItemTargets || options.items.length === 0}
                  >
                    {copy('addItem')}
                  </DButton>
                </div>

                <ItemVariantTargetSelector
                  items={visibleItemTargets}
                  variants={options.variants}
                  itemIds={itemIds}
                  variantIds={variantIds}
                  onItemsChange={setItemIds}
                  onVariantsChange={setVariantIds}
                  emptyLabel={copy('noOptions')}
                  specificLabel={copy('specificVariants')}
                  includedLabel={copy('includedViaParent')}
                  notIncludedLabel={copy('notIncluded')}
                  parentIncludesVariantsLabel={copy('parentIncludesVariants')}
                  activeLabel={copy('active')}
                />
              </section>
            ) : null}

            {scope === 'CATEGORY' ? (
              <section className="space-y-3">
                <TargetSelector
                  label={copy('targets')}
                  options={options.categories}
                  selected={categoryIds}
                  onChange={changeCategories}
                  emptyLabel={copy('noOptions')}
                />

                <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
                  <span className="text-xs font-medium">{copy('selectedCategoriesAllItems')}</span>
                  <DToggle
                    checked={categoryItemScope === 'ALL'}
                    onChange={(checked) => changeCategoryItemScope(checked ? 'ALL' : 'SELECTED')}
                    ariaLabel={copy('selectedCategoriesAllItems')}
                  />
                </div>

                {categoryItemScope === 'SELECTED' ? (
                  <TargetSelector
                    label={copy('selectCategoryItems')}
                    options={categoryItemOptions}
                    selected={itemIds}
                    onChange={setItemIds}
                    emptyLabel={copy('noCategoryItems')}
                  />
                ) : null}
              </section>
            ) : null}

            {scope === 'TRANSACTION' ? (
              <div className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/55 px-4 py-5 text-center">
                <p className="text-sm font-semibold">{copy('allTransactions')}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {copy('allTransactionsHint')}
                </p>
              </div>
            ) : null}

            <TargetSelector
              label={
                copy('locations') +
                ' · ' +
                (locationIds.length
                  ? String(locationIds.length) + ' ' + copy('selected')
                  : copy('allLocations'))
              }
              options={options.locations}
              selected={locationIds}
              onChange={setLocationIds}
              emptyLabel={copy('noOptions')}
            />
          </div>
        )}
      </div>
    </DDialog>
  );
}

function ItemVariantTargetSelector({
  items,
  variants,
  itemIds,
  variantIds,
  onItemsChange,
  onVariantsChange,
  emptyLabel,
  specificLabel,
  includedLabel,
  notIncludedLabel,
  parentIncludesVariantsLabel,
  activeLabel,
}: {
  items: PromotionReferenceOption[];
  variants: PromotionReferenceOption[];
  itemIds: string[];
  variantIds: string[];
  onItemsChange: (ids: string[]) => void;
  onVariantsChange: (ids: string[]) => void;
  emptyLabel: string;
  specificLabel: string;
  includedLabel: string;
  notIncludedLabel: string;
  parentIncludesVariantsLabel: string;
  activeLabel: string;
}) {
  const itemSet = new Set(itemIds);
  const variantSet = new Set(variantIds);

  const toggleParent = (itemId: string) => {
    onItemsChange(
      itemSet.has(itemId) ? itemIds.filter((id) => id !== itemId) : [...itemIds, itemId],
    );
  };

  const toggleVariant = (variantId: string, parentSelected: boolean) => {
    if (parentSelected) return;
    onVariantsChange(
      variantSet.has(variantId)
        ? variantIds.filter((id) => id !== variantId)
        : [...variantIds, variantId],
    );
  };

  if (!items.length) {
    return (
      <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] px-3 py-4 text-sm text-[var(--color-text-muted)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
      {items.map((item) => {
        const parentSelected = itemSet.has(item.id);
        const children = variants.filter((variant) => variant.catalogItemId === item.id);
        const explicitVariantCount = children.filter((variant) => variantSet.has(variant.id)).length;
        const groupActive = parentSelected || explicitVariantCount > 0;

        return (
          <div
            key={item.id}
            className={[
              'rounded-lg border',
              groupActive
                ? 'border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[.025]'
                : 'border-[var(--color-border)]',
            ].join(' ')}
          >
            <button
              type="button"
              aria-pressed={parentSelected}
              onClick={() => toggleParent(item.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <span
                className={[
                  'grid size-4 shrink-0 place-items-center rounded border',
                  parentSelected
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]',
                ].join(' ')}
              >
                {parentSelected ? <Check className="size-3" /> : null}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-xs font-semibold">{item.name}</span>
                  <span className="shrink-0 text-[9px] text-[var(--color-text-muted)]">
                    {item.code}
                  </span>
                </div>
                {parentSelected ? (
                  <p className="mt-0.5 text-[9px] text-[var(--color-text-muted)]">
                    {parentIncludesVariantsLabel}
                  </p>
                ) : null}
              </div>

              {explicitVariantCount > 0 ? (
                <DBadge variant="secondary">
                  {explicitVariantCount} {specificLabel}
                </DBadge>
              ) : null}
              {children.length ? (
                <ChevronRight className="size-3.5 shrink-0 text-[var(--color-text-muted)]" />
              ) : null}
            </button>

            {children.length ? (
              <div className="space-y-1 border-t border-[var(--color-border)] px-3 py-2 pl-7">
                {children.map((variant) => {
                  const explicitlySelected = variantSet.has(variant.id);
                  const effectiveSelected = parentSelected || explicitlySelected;

                  return (
                    <button
                      key={variant.id}
                      type="button"
                      aria-pressed={effectiveSelected}
                      onClick={() => toggleVariant(variant.id, parentSelected)}
                      className={[
                        'flex w-full items-center gap-2 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-left transition-colors',
                        effectiveSelected
                          ? 'border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[.04]'
                          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]',
                        parentSelected ? 'cursor-default' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'grid size-4 shrink-0 place-items-center rounded border',
                          effectiveSelected
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                            : 'border-[var(--color-border)]',
                        ].join(' ')}
                      >
                        {effectiveSelected ? <Check className="size-3" /> : null}
                      </span>

                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                        {variant.name}
                        <span className="ml-2 text-[9px] font-normal text-[var(--color-text-muted)]">
                          {variant.code}
                        </span>
                      </span>

                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold',
                          effectiveSelected
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'text-slate-400',
                        ].join(' ')}
                      >
                        {parentSelected
                          ? includedLabel
                          : explicitlySelected
                            ? activeLabel
                            : notIncludedLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
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
