import { DButton, DDatePicker, DDialog, DInput, DSelect, DToggle, useToast } from '@digvation/ui';
import { Check, Info, List, LockKeyhole, Tag, Trash2, X } from 'lucide-react';
import { useMemo } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import type {
  Promotion,
  PromotionMode,
  PromotionReferenceOptions,
  PromotionsApi,
} from '../../../entities/promotion';
import { usePromotionsLocalization } from '../config/promotion.i18n';
import {
  toPromotionWriteInput,
  validatePromotionEditorForm,
} from '../model/promotion-editor-form';
import { usePromotionEditor } from '../model/use-promotion-editor';
import { ItemVariantTargetSelector } from './item-variant-target-selector';
import { TargetSelector } from './target-selector';

export interface PromotionDialogProps {
  promotion: Promotion | null;
  options: PromotionReferenceOptions;
  api: PromotionsApi;
  onClose: () => void;
  onChanged: () => void;
}

export function PromotionDialog({
  promotion,
  options,
  api,
  onClose,
  onChanged,
}: PromotionDialogProps) {
  const copy = usePromotionsLocalization();
  const { showToast } = useToast();
  const editor = usePromotionEditor(promotion);
  const form = editor.form;
  const { valid, periodValid } = validatePromotionEditorForm(form);

  const categoryItemOptions = useMemo(() => {
    const selectedCategories = new Set(form.categoryIds);
    return options.items.filter(
      (option) => option.categoryId && selectedCategories.has(option.categoryId),
    );
  }, [form.categoryIds, options.items]);

  const selectedItemGroups = useMemo(() => {
    const parentIds = new Set(form.itemIds);
    for (const variant of options.variants) {
      if (form.variantIds.includes(variant.id) && variant.catalogItemId) {
        parentIds.add(variant.catalogItemId);
      }
    }
    return parentIds;
  }, [form.itemIds, options.variants, form.variantIds]);

  // Search is now the only discovery affordance, so the target workspace must
  // always keep the full catalog visible. Selection changes state, not visibility.
  const visibleItemTargets = options.items;

  const save = async () => {
    if (!valid || editor.ui.saving) return;

    editor.actions.setSaving(true);
    const input = toPromotionWriteInput(form);

    try {
      if (promotion) await api.update(promotion.id, promotion.version, input);
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
      editor.actions.setSaving(false);
    }
  };

  const targetStepSummary =
    form.scope === 'TRANSACTION'
      ? copy('allItems')
      : form.scope === 'CATEGORY'
        ? String(form.categoryIds.length) + ' ' + copy('category')
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
              <span className="rounded-md border border-(--color-brand)/25 bg-(--color-brand)/6 px-2 py-0.5 text-[11px] font-semibold text-(--color-brand)">
                {copy('newBadge')}
              </span>
            ) : promotion.code ? (
              <span className="rounded-md border border-(--color-brand)/25 bg-(--color-brand)/6 px-2 py-0.5 font-mono text-[11px] font-semibold text-(--color-brand)">
                {promotion.code}
              </span>
            ) : null}
            {promotion ? (
              <span
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                  enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)',
                ].join(' ')}
              >
                <span
                  className={[
                    'size-1.5 rounded-full',
                    form.form.enabled ? 'bg-emerald-500' : 'bg-(--color-text-muted)',
                  ].join(' ')}
                />
                {form.form.enabled ? copy('active') : copy('disabled')}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            aria-label={copy('cancel')}
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-brand)/20"
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
              aria-pressed={editor.ui.step === 'INFORMATION'}
              onClick={() => editor.actions.setStep('INFORMATION')}
              className={[
                'flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all',
                editor.ui.step === 'INFORMATION'
                  ? 'border border-slate-200 bg-white text-(--color-brand) shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <Info className="size-3.5" />
              <span>{copy('informationStep')}</span>
            </button>
            <button
              type="button"
              aria-pressed={editor.ui.step === 'TARGET'}
              onClick={() => editor.actions.setStep('TARGET')}
              className={[
                'flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all',
                editor.ui.step === 'TARGET'
                  ? 'border border-slate-200 bg-white text-(--color-brand) shadow-sm'
                  : 'text-slate-600 hover:text-slate-900',
              ].join(' ')}
            >
              <List className="size-3.5" />
              <span>{copy('targetStep')}</span>
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                  editor.ui.step === 'TARGET' ? 'bg-blue-50 text-(--color-brand)' : 'text-slate-400',
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
      className="sm:max-h-[calc(100vh-24px)] sm:max-w-135 sm:rounded-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div>
            {promotion ? (
              <DButton
                variant="outline"
                size="sm"
                disabled
                title={copy('deleteUnavailable')}
                className="border-(--color-danger)/35 text-(--color-danger)"
                leftIcon={<Trash2 className="size-3.5" />}
              >
                {copy('deletePromotion')}
              </DButton>
            ) : (
              <span className="text-[11px] font-medium text-(--color-danger)">
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
              disabled={!valid || editor.ui.saving}
              loading={editor.ui.saving}
            >
              {promotion ? copy('saveChanges') : copy('savePromotion')}
            </DButton>
          </div>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-135 space-y-5">
        {editor.ui.step === 'INFORMATION' ? (
          <div className="space-y-4">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-5 place-items-center rounded-full bg-blue-50 text-(--color-brand)">
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
                    value={form.name}
                    onChange={(value) => editor.setField('name', value)}
                    placeholder={copy('namePlaceholder')}
                  />
                </div>

                <DSelect
                  size="sm"
                  label={copy('mode')}
                  value={form.mode}
                  clearable={false}
                  options={[
                    { value: 'AUTOMATIC', label: copy('automatic') },
                    { value: 'CODE', label: copy('code') },
                  ]}
                  onValueChange={(value) => editor.actions.changeMode(value as PromotionMode)}
                />

                <DInput
                  size="sm"
                  clearable={false}
                  label={copy('codeLabel')}
                  value={form.code}
                  readOnly={form.mode === 'AUTOMATIC'}
                  className={
                    form.mode === 'AUTOMATIC' ? 'read-only:bg-white read-only:text-slate-400' : undefined
                  }
                  onChange={(value) => editor.setField('code', value.toUpperCase())}
                  placeholder={form.mode === 'AUTOMATIC' ? copy('automaticCodeHint') : 'SEP10'}
                />

                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-3">
                  <div>
                    <p className="text-xs font-semibold">{copy('operationalStatus')}</p>
                    <p className="mt-0.5 text-[10px] text-(--color-text-muted)">
                      {copy('operationalStatusHint')}
                    </p>
                  </div>
                  <DToggle checked={form.enabled} onChange={(value) => editor.setField('enabled', value)} ariaLabel={copy('enabled')} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="grid size-5 place-items-center rounded-full bg-blue-50 text-(--color-brand)">
                  <Tag className="size-3" />
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                  {copy('termsAndDiscount')}
                </h3>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={form.discountType === 'PERCENTAGE'}
                  onClick={() => editor.actions.changeDiscountType('PERCENTAGE')}
                  className={[
                    'min-h-18 rounded-xl border px-3 py-2.5 text-left transition-all',
                    form.discountType === 'PERCENTAGE'
                      ? 'border-2 border-(--color-brand) bg-blue-50/30'
                      : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/35',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                        form.discountType === 'PERCENTAGE'
                          ? 'border-(--color-brand) bg-(--color-brand) text-white'
                          : 'border-(--color-border)',
                      ].join(' ')}
                    >
                      {form.discountType === 'PERCENTAGE' ? <Check className="size-2.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold">{copy('percentageCard')}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-(--color-text-muted)">
                        {copy('percentageCardHint')}
                      </span>
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  aria-pressed={form.discountType === 'FIXED_AMOUNT'}
                  onClick={() => editor.actions.changeDiscountType('FIXED_AMOUNT')}
                  className={[
                    'min-h-18 rounded-xl border px-3 py-2.5 text-left transition-all',
                    form.discountType === 'FIXED_AMOUNT'
                      ? 'border-2 border-(--color-brand) bg-blue-50/30'
                      : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-brand)/35',
                  ].join(' ')}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                        form.discountType === 'FIXED_AMOUNT'
                          ? 'border-(--color-brand) bg-(--color-brand) text-white'
                          : 'border-(--color-border)',
                      ].join(' ')}
                    >
                      {form.discountType === 'FIXED_AMOUNT' ? <Check className="size-2.5" /> : null}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold">{copy('fixedCard')}</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-(--color-text-muted)">
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
                    value={form.discountValue}
                    prefix={form.discountType === 'FIXED_AMOUNT' ? 'Rp' : undefined}
                    suffix={form.discountType === 'PERCENTAGE' ? '%' : undefined}
                    onChange={(value) => editor.setField('discountValue', value)}
                  />
                  <p className="mt-1 text-[10px] text-(--color-text-muted)">
                    {copy(form.discountType === 'PERCENTAGE' ? 'percentageHint' : 'fixedHint')}
                  </p>
                </div>

                <div className="flex min-w-0 flex-col gap-1.5">
                  <label className="text-xs font-medium text-(--color-text)">
                    {copy('currency')}
                  </label>
                  <div
                    aria-label={copy('currencyLocked')}
                    className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-100/80 px-3"
                  >
                    <span className="truncate text-xs font-semibold text-slate-700">
                      {form.currency === 'IDR' ? 'IDR (Rupiah)' : form.currency}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">
                      <LockKeyhole className="size-2.5" />
                      {copy('defaultLocked')}
                    </span>
                  </div>
                </div>

                {form.discountType === 'PERCENTAGE' ? (
                  <DInput
                    size="sm"
                    clearable={false}
                    prefix="Rp"
                    label={
                      <span>
                        {copy('maximum')}{' '}
                        <span className="font-normal text-(--color-text-muted)">
                          ({copy('optional')})
                        </span>
                      </span>
                    }
                    inputMode="decimal"
                    value={form.maximumDiscount}
                    placeholder={copy('maximumPlaceholder')}
                    onChange={(value) => editor.setField('maximumDiscount', value)}
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
                      <span className="font-normal text-(--color-text-muted)">
                        ({copy('optional')})
                      </span>
                    </span>
                  }
                  inputMode="decimal"
                  value={form.minimumPurchase}
                  placeholder={copy('minimumPlaceholder')}
                  onChange={(value) => editor.setField('minimumPurchase', value)}
                />

                <DDatePicker
                  label={copy('effectiveFrom') + ' (' + copy('optional') + ')'}
                  variant="date-time"
                  value={form.effectiveFrom}
                  onChange={(value) => editor.setField('effectiveFrom', value == null ? '' : String(value))}
                  onClear={() => editor.setField('effectiveFrom', '')}
                  clearable
                />
                <DDatePicker
                  label={copy('effectiveUntil') + ' (' + copy('optional') + ')'}
                  variant="date-time"
                  value={form.effectiveUntil}
                  onChange={(value) => editor.setField('effectiveUntil', value == null ? '' : String(value))}
                  onClear={() => editor.setField('effectiveUntil', '')}
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
                  const active = form.scope === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => editor.actions.changeScope(option.value)}
                      className={[
                        'flex min-h-17 flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all',
                        active
                          ? 'border-2 border-(--color-brand) bg-blue-50/30 text-(--color-brand)'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-(--color-brand)/35',
                      ].join(' ')}
                    >
                      <span className="block text-xs font-semibold">{option.title}</span>
                      <span
                        className={[
                          'mt-1 block text-[10px]',
                          active ? 'text-(--color-brand)/80' : 'text-slate-400',
                        ].join(' ')}
                      >
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {form.scope === 'ITEM' ? (
              <section>
                <div className="mb-2">
                  <h3 className="text-xs font-semibold">
                    {copy('targetItems')}
                    <span className="ml-2 text-[10px] font-medium text-(--color-text-muted)">
                      {selectedItemGroups.size} {copy('selectedActive')}
                    </span>
                  </h3>
                  <p className="mt-0.5 text-[10px] text-(--color-text-muted)">
                    {copy('targetWorkspaceHint')}
                  </p>
                </div>

                <ItemVariantTargetSelector
                  items={visibleItemTargets}
                  searchItems={options.items}
                  variants={options.variants}
                  itemIds={form.itemIds}
                  variantIds={form.variantIds}
                  onItemsChange={(ids) => editor.setField('itemIds', ids)}
                  onVariantsChange={(ids) => editor.setField('variantIds', ids)}
                  emptyLabel={copy('noOptions')}
                  specificLabel={copy('specificVariants')}
                  includedLabel={copy('includedViaParent')}
                  notIncludedLabel={copy('notIncluded')}
                  parentIncludesVariantsLabel={copy('parentIncludesVariants')}
                  activeLabel={copy('active')}
                  searchLabel={copy('searchTargets')}
                  searchPlaceholder={copy('searchTargetsPlaceholder')}
                  noSearchResults={copy('noTargetSearchResults')}
                />
              </section>
            ) : null}

            {form.scope === 'CATEGORY' ? (
              <section className="space-y-3">
                <TargetSelector
                  label={copy('targets')}
                  options={options.categories}
                  selected={form.categoryIds}
                  onChange={(ids) => editor.actions.changeCategories(ids, options.items)}
                  emptyLabel={copy('noOptions')}
                />

                <div className="flex items-center justify-between rounded-(--radius-control) border border-(--color-border) bg-(--color-surface) px-3 py-2.5">
                  <span className="text-xs font-medium">{copy('selectedCategoriesAllItems')}</span>
                  <DToggle
                    checked={form.categoryItemScope === 'ALL'}
                    onChange={(checked) => editor.actions.changeCategoryItemScope(checked ? 'ALL' : 'SELECTED')}
                    ariaLabel={copy('selectedCategoriesAllItems')}
                  />
                </div>

                {form.categoryItemScope === 'SELECTED' ? (
                  <TargetSelector
                    label={copy('selectCategoryItems')}
                    options={categoryItemOptions}
                    selected={form.itemIds}
                    onChange={(ids) => editor.setField('itemIds', ids)}
                    emptyLabel={copy('noCategoryItems')}
                  />
                ) : null}
              </section>
            ) : null}

            {form.scope === 'TRANSACTION' ? (
              <div className="rounded-(--radius-control) border border-dashed border-(--color-border) bg-(--color-surface-muted)/55 px-4 py-5 text-center">
                <p className="text-sm font-semibold">{copy('allTransactions')}</p>
                <p className="mt-1 text-xs text-(--color-text-muted)">
                  {copy('allTransactionsHint')}
                </p>
              </div>
            ) : null}

            <TargetSelector
              label={
                copy('locations') +
                ' · ' +
                (form.locationIds.length
                  ? String(form.locationIds.length) + ' ' + copy('selected')
                  : copy('allLocations'))
              }
              options={options.locations}
              selected={form.locationIds}
              onChange={(ids) => editor.setField('locationIds', ids)}
              emptyLabel={copy('noOptions')}
            />
          </div>
        )}
      </div>
    </DDialog>
  );
}
