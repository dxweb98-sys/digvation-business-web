import {
  DBadge,
  DButton,
  DDatePicker,
  DDialog,
  DInfoNote,
  DInput,
  DSelect,
  DToggle,
  useToast,
} from '@digvation/ui';
import { Check } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import { useFormState } from '../../shared/forms/use-form-state';
import {
  categoriesChange,
  categoryItemScopeChange,
  createPromotionEditorForm,
  discountTypeChange,
  modeChange,
  scopeChange,
  toPromotionWriteInput,
  validatePromotionEditorForm,
  type PromotionEditorStep,
} from './promotion-editor-form';
import { ItemVariantTargetSelector, TargetSelector } from './promotion-target-selectors';
import type {
  Promotion,
  PromotionAudience,
  PromotionMode,
  PromotionReferenceOptions,
  PromotionScope,
  PromotionsApi,
} from './promotions-api';
import { usePromotionsLocalization, type PromotionMessageKey } from './promotions-localization';

const statusKey = {
  ACTIVE: 'active',
  SCHEDULED: 'scheduled',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
} as const satisfies Record<Promotion['status'], PromotionMessageKey>;

export function PromotionDialog({
  promotion,
  options,
  api,
  membershipAvailable,
  onClose,
  onChanged,
}: {
  promotion: Promotion | null;
  options: PromotionReferenceOptions;
  api: PromotionsApi;
  /** MEMBERS_ONLY needs the Membership capability; Runtime enforces it too. */
  membershipAvailable: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const copy = usePromotionsLocalization();
  const { showToast } = useToast();
  const {
    values: form,
    patch,
    setField,
  } = useFormState(() => createPromotionEditorForm(promotion));
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<PromotionEditorStep>('INFORMATION');
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
  }, [form.itemIds, form.variantIds, options.variants]);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const input = toPromotionWriteInput(form, { membershipAvailable });
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
          normalized.code === 'CAPABILITY_NOT_ENTITLED'
            ? copy('membershipUnavailable')
            : normalized.code === 'FORBIDDEN' || normalized.status === 403
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

  const targetSummary =
    form.scope === 'TRANSACTION'
      ? copy('allItems')
      : form.scope === 'CATEGORY'
        ? `${form.categoryIds.length} ${copy('category')}`
        : selectedItemGroups.size > 0
          ? `${selectedItemGroups.size} ${copy('activeShort')}`
          : copy('allItems');

  return (
    <DDialog
      open
      onClose={onClose}
      size="lg"
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-brand)]" aria-hidden="true" />
          <span>{promotion ? copy('edit') : copy('add')}</span>
          {promotion?.code ? <DBadge variant="info">{promotion.code}</DBadge> : null}
          {promotion ? (
            <DBadge variant={promotion.status === 'ACTIVE' ? 'success' : 'secondary'}>
              {copy(statusKey[promotion.status])}
            </DBadge>
          ) : null}
        </div>
      }
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
      <div className="space-y-5">
        <PromotionPanel ariaLabel={copy('promotionInfo')} className="p-5">
          <div className="space-y-3">
            <DInput
              label={copy('name')}
              value={form.name}
              onChange={(value) => setField('name', value)}
              placeholder={copy('namePlaceholder')}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <DSelect
                label={copy('mode')}
                value={form.mode}
                clearable={false}
                options={[
                  { value: 'AUTOMATIC', label: copy('automatic') },
                  { value: 'CODE', label: copy('code') },
                ]}
                onChange={(value) => patch(modeChange(value as PromotionMode))}
              />
              <DInput
                label={copy('codeLabel')}
                value={form.code}
                disabled={form.mode === 'AUTOMATIC'}
                hint={form.mode === 'AUTOMATIC' ? copy('automaticCodeHint') : undefined}
                onChange={(value) => setField('code', value.toUpperCase())}
                placeholder={form.mode === 'AUTOMATIC' ? undefined : 'SEP10'}
              />
            </div>

            <DSelect
              label={copy('audience')}
              value={form.audience}
              clearable={false}
              options={[
                { value: 'ALL', label: copy('audienceAll') },
                {
                  value: 'MEMBERS_ONLY',
                  label: copy('audienceMembersOnly'),
                  disabled: !membershipAvailable,
                },
              ]}
              onChange={(value) => setField('audience', value as PromotionAudience)}
              hint={
                !membershipAvailable && form.audience === 'ALL'
                  ? copy('audienceMembershipRequired')
                  : form.audience === 'MEMBERS_ONLY'
                    ? copy('audienceMembersOnlyHint')
                    : copy('audienceAllHint')
              }
            />
            {!membershipAvailable && form.audience === 'MEMBERS_ONLY' ? (
              <DInfoNote variant="warning">{copy('audienceMembershipInactive')}</DInfoNote>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {copy('operationalStatus')}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {copy('operationalStatusHint')}
                </p>
              </div>
              <DToggle
                checked={form.enabled}
                onChange={(checked) => setField('enabled', checked)}
                ariaLabel={copy('enabled')}
              />
            </div>
          </div>
        </PromotionPanel>

        <PromotionPanel ariaLabel={copy('settings')}>
          <PromotionEditorTabs
            value={step}
            ariaLabel={copy('settings')}
            onChange={setStep}
            tabs={[
              { value: 'INFORMATION', label: copy('termsAndDiscount') },
              { value: 'TARGET', label: copy('targetStep'), meta: targetSummary },
            ]}
          />

          {step === 'INFORMATION' ? (
            <div role="tabpanel" aria-label={copy('termsAndDiscount')} className="p-5">
              <div className="grid gap-2 sm:grid-cols-2">
                <ChoiceCard
                  selected={form.discountType === 'PERCENTAGE'}
                  title={copy('percentageCard')}
                  hint={copy('percentageCardHint')}
                  onSelect={() => patch(discountTypeChange('PERCENTAGE'))}
                />
                <ChoiceCard
                  selected={form.discountType === 'FIXED_AMOUNT'}
                  title={copy('fixedCard')}
                  hint={copy('fixedCardHint')}
                  onSelect={() => patch(discountTypeChange('FIXED_AMOUNT'))}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <DInput
                  label={copy('value')}
                  inputMode="decimal"
                  value={form.discountValue}
                  prefix={form.discountType === 'FIXED_AMOUNT' ? 'Rp' : undefined}
                  suffix={form.discountType === 'PERCENTAGE' ? '%' : undefined}
                  hint={copy(form.discountType === 'PERCENTAGE' ? 'percentageHint' : 'fixedHint')}
                  onChange={(value) => setField('discountValue', value)}
                />
                <DInput
                  label={copy('currency')}
                  value={form.currency === 'IDR' ? 'IDR (Rupiah)' : form.currency}
                  hint={copy('currencyLocked')}
                  disabled
                />

                {form.discountType === 'PERCENTAGE' ? (
                  <DInput
                    label={`${copy('maximum')} (${copy('optional')})`}
                    prefix="Rp"
                    inputMode="decimal"
                    value={form.maximumDiscount}
                    placeholder={copy('maximumPlaceholder')}
                    onChange={(value) => setField('maximumDiscount', value)}
                  />
                ) : null}

                <DInput
                  label={`${copy('minimum')} (${copy('optional')})`}
                  prefix="Rp"
                  inputMode="decimal"
                  value={form.minimumPurchase}
                  placeholder={copy('minimumPlaceholder')}
                  onChange={(value) => setField('minimumPurchase', value)}
                />

                <DDatePicker
                  label={`${copy('effectiveFrom')} (${copy('optional')})`}
                  variant="date-time"
                  value={form.effectiveFrom}
                  onChange={(value) =>
                    setField('effectiveFrom', value == null ? '' : String(value))
                  }
                  onClear={() => setField('effectiveFrom', '')}
                  clearable
                />
                <DDatePicker
                  label={`${copy('effectiveUntil')} (${copy('optional')})`}
                  variant="date-time"
                  value={form.effectiveUntil}
                  onChange={(value) =>
                    setField('effectiveUntil', value == null ? '' : String(value))
                  }
                  onClear={() => setField('effectiveUntil', '')}
                  clearable
                  error={periodValid ? undefined : copy('invalid')}
                />
              </div>
            </div>
          ) : (
            <div role="tabpanel" aria-label={copy('targetStep')} className="space-y-4 p-5">
              <section>
                <h3 className="mb-2 text-sm font-medium text-[var(--color-text)]">
                  {copy('scopePromo')}
                </h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(
                    [
                      ['TRANSACTION', 'allTransactions', 'allTransactionsHint'],
                      ['CATEGORY', 'perCategory', 'perCategoryHint'],
                      ['ITEM', 'perItemVariant', 'perItemVariantHint'],
                    ] as const satisfies ReadonlyArray<
                      readonly [PromotionScope, PromotionMessageKey, PromotionMessageKey]
                    >
                  ).map(([value, title, hint]) => (
                    <ChoiceCard
                      key={value}
                      selected={form.scope === value}
                      title={copy(title)}
                      hint={copy(hint)}
                      onSelect={() => patch(scopeChange(value))}
                    />
                  ))}
                </div>
              </section>

              {form.scope === 'ITEM' ? (
                <section>
                  <div className="mb-2">
                    <h3 className="text-sm font-medium text-[var(--color-text)]">
                      {copy('targetItems')}
                      <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                        {selectedItemGroups.size} {copy('selectedActive')}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {copy('targetWorkspaceHint')}
                    </p>
                  </div>

                  <ItemVariantTargetSelector
                    items={options.items}
                    variants={options.variants}
                    itemIds={form.itemIds}
                    variantIds={form.variantIds}
                    onItemsChange={(itemIds) => setField('itemIds', itemIds)}
                    onVariantsChange={(variantIds) => setField('variantIds', variantIds)}
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
                    onChange={(ids) => patch(categoriesChange(form, ids, options.items))}
                    emptyLabel={copy('noOptions')}
                  />

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3.5 py-3">
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {copy('selectedCategoriesAllItems')}
                    </span>
                    <DToggle
                      checked={form.categoryItemScope === 'ALL'}
                      onChange={(checked) =>
                        patch(categoryItemScopeChange(checked ? 'ALL' : 'SELECTED'))
                      }
                      ariaLabel={copy('selectedCategoriesAllItems')}
                    />
                  </div>

                  {form.categoryItemScope === 'SELECTED' ? (
                    <TargetSelector
                      label={copy('selectCategoryItems')}
                      options={categoryItemOptions}
                      selected={form.itemIds}
                      onChange={(itemIds) => setField('itemIds', itemIds)}
                      emptyLabel={copy('noCategoryItems')}
                    />
                  ) : null}
                </section>
              ) : null}

              {form.scope === 'TRANSACTION' ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/40 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {copy('allTransactions')}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {copy('allTransactionsHint')}
                  </p>
                </div>
              ) : null}

              <TargetSelector
                label={`${copy('locations')} · ${
                  form.locationIds.length
                    ? `${form.locationIds.length} ${copy('selected')}`
                    : copy('allLocations')
                }`}
                options={options.locations}
                selected={form.locationIds}
                onChange={(locationIds) => setField('locationIds', locationIds)}
                emptyLabel={copy('noOptions')}
              />
            </div>
          )}
        </PromotionPanel>
      </div>
    </DDialog>
  );
}

/* Promotion-local composition in the accepted Backoffice dialog language (see Catalog). */

function PromotionPanel({
  children,
  ariaLabel,
  className = '',
}: {
  children: ReactNode;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

function PromotionEditorTabs({
  value,
  tabs,
  onChange,
  ariaLabel,
}: {
  value: PromotionEditorStep;
  tabs: Array<{ value: PromotionEditorStep; label: string; meta?: string }>;
  onChange: (value: PromotionEditorStep) => void;
  ariaLabel: string;
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-4 pt-3">
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const selected = value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.value)}
              className={`border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                selected
                  ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
              {tab.meta ? (
                <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px]">
                  {tab.meta}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceCard({
  selected,
  title,
  hint,
  onSelect,
}: {
  selected: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={[
        'flex min-h-16 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/[.04] ring-1 ring-[var(--color-brand)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/40',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
          selected
            ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
            : 'border-[var(--color-border)]',
        ].join(' ')}
      >
        {selected ? <Check className="size-2.5" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--color-text)]">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
          {hint}
        </span>
      </span>
    </button>
  );
}
