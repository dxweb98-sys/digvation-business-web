import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DConfirmDialog,
  DDataTable,
  DDatePicker,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  DToggle,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import {
  BackofficePage,
  BackofficePageHeader,
} from '../../app/layout/backoffice-page';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import {
  isSessionExpiredError,
  useBackofficeAuth,
} from '../../auth/backoffice-auth-context';
import { TaxApi, type TaxCategory, type TaxProfile, type TaxRule } from './tax-api';
import { useTaxLocalization, type TaxMessageKey } from './tax-localization';

const keys = {
  profile: ['tax', 'profile'] as const,
  categories: ['tax', 'categories'] as const,
  rules: ['tax', 'rules'] as const,
};

export function TaxPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy, tax } = useTaxLocalization();
  const api = useMemo(
    () => new TaxApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );

  const canRead = Boolean(session && canPerformBackofficeAction(session, 'viewTax'));
  const canCreate = Boolean(session && canPerformBackofficeAction(session, 'createTax'));
  const canUpdate = Boolean(session && canPerformBackofficeAction(session, 'updateTax'));
  const canCancel = Boolean(session && canPerformBackofficeAction(session, 'cancelTax'));

  const profile = useQuery({
    queryKey: keys.profile,
    queryFn: () => api.profile(),
    enabled: canRead,
  });
  const categories = useQuery({
    queryKey: keys.categories,
    queryFn: () => api.categories(),
    enabled: canRead,
  });
  const rules = useQuery({
    queryKey: keys.rules,
    queryFn: () => api.rules(),
    enabled: canRead,
  });

  if (!session) return null;

  const refresh = (queryKey: readonly string[]) =>
    void queryClient.invalidateQueries({ queryKey });

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Configuration')}
        title={copy('Tax')}
        description={tax('pageDescription')}
      />

      <DTabs defaultValue="profile" className="mt-6">
        <DTabsList>
          <DTabsTrigger value="profile">{tax('profile')}</DTabsTrigger>
          <DTabsTrigger value="categories">{tax('categories')}</DTabsTrigger>
          <DTabsTrigger value="rules">{tax('rules')}</DTabsTrigger>
        </DTabsList>
        <DTabsContent value="profile" className="mt-5">
          <TaxProfileSection
            profile={profile.data}
            loading={profile.isLoading}
            canUpdate={canUpdate}
            api={api}
            onChanged={() => refresh(keys.profile)}
          />
        </DTabsContent>
        <DTabsContent value="categories" className="mt-5">
          <TaxCategoriesSection
            categories={categories.data?.items ?? []}
            loading={categories.isLoading}
            canCreate={canCreate}
            canUpdate={canUpdate}
            api={api}
            onChanged={() => refresh(keys.categories)}
          />
        </DTabsContent>
        <DTabsContent value="rules" className="mt-5">
          <TaxRulesSection
            rules={rules.data?.items ?? []}
            categories={categories.data?.items ?? []}
            loading={rules.isLoading}
            canCreate={canCreate}
            canCancel={canCancel}
            api={api}
            onChanged={() => refresh(keys.rules)}
          />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}

function TaxProfileSection({
  profile,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  profile?: TaxProfile;
  loading: boolean;
  canUpdate: boolean;
  api: TaxApi;
  onChanged: () => void;
}) {
  const { tax } = useTaxLocalization();
  const { showToast } = useToast();
  const [itemTaxEnabled, setItemTaxEnabled] = useState(false);
  const [transactionTaxEnabled, setTransactionTaxEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setItemTaxEnabled(profile.itemTaxEnabled);
    setTransactionTaxEnabled(profile.transactionTaxEnabled);
  }, [profile]);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await api.updateProfile(profile, { itemTaxEnabled, transactionTaxEnabled });
      onChanged();
      showToast({ variant: 'success', title: tax('profileSaved') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: taxApiMessage(error, tax, 'profileSaveFailed'),
        });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="max-w-3xl space-y-3">
        <DSkeleton className="h-14" />
        <DSkeleton className="h-14" />
      </div>
    );

  return (
    <div className="max-w-3xl">
      <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)]">{tax('itemTax')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{tax('itemTaxHint')}</p>
          </div>
          <DToggle
            checked={itemTaxEnabled}
            onChange={setItemTaxEnabled}
            disabled={!canUpdate}
            aria-label={tax('itemTax')}
          />
        </div>
        <div className="flex items-center justify-between gap-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)]">{tax('transactionTax')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{tax('transactionTaxHint')}</p>
          </div>
          <DToggle
            checked={transactionTaxEnabled}
            onChange={setTransactionTaxEnabled}
            disabled={!canUpdate}
            aria-label={tax('transactionTax')}
          />
        </div>
      </div>
      {canUpdate && profile ? (
        <div className="mt-4 flex justify-end">
          <DButton onClick={() => void save()} disabled={saving}>
            {tax('saveProfile')}
          </DButton>
        </div>
      ) : null}
    </div>
  );
}

function TaxCategoriesSection({
  categories,
  loading,
  canCreate,
  canUpdate,
  api,
  onChanged,
}: {
  categories: TaxCategory[];
  loading: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  api: TaxApi;
  onChanged: () => void;
}) {
  const { tax } = useTaxLocalization();
  const [editing, setEditing] = useState<TaxCategory | null | undefined>();
  const columns: TableColumn<TaxCategory>[] = [
    { key: 'code', label: tax('code') },
    { key: 'name', label: tax('name') },
    {
      key: 'status',
      label: tax('status'),
      render: (row) => (
        <DBadge variant={row.status === 'ACTIVE' ? 'outline' : 'secondary'}>
          {tax(row.status === 'ACTIVE' ? 'active' : 'inactive')}
        </DBadge>
      ),
    },
  ];

  return (
    <>
      <DDataTable
        columns={columns}
        data={categories}
        loading={loading}
        rowKey="id"
        emptyMessage={tax('categoryEmpty')}
        headerActions={
          canCreate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
              {tax('addCategory')}
            </DButton>
          ) : null
        }
        actions={
          canUpdate
            ? [
                {
                  label: tax('editCategory'),
                  icon: <Pencil className="size-4" />,
                  onClick: (row) => setEditing(row),
                },
              ]
            : []
        }
      />
      <TaxCategoryDialog
        category={editing}
        api={api}
        onClose={() => setEditing(undefined)}
        onChanged={onChanged}
      />
    </>
  );
}

function TaxCategoryDialog({
  category,
  api,
  onClose,
  onChanged,
}: {
  category: TaxCategory | null | undefined;
  api: TaxApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tax } = useTaxLocalization();
  const { showToast } = useToast();
  const isNew = category === null;
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<TaxCategory['status']>('ACTIVE');

  useEffect(() => {
    setCode('');
    setName(category?.name ?? '');
    setStatus(category?.status ?? 'ACTIVE');
  }, [category]);

  const save = async () => {
    if (!name.trim() || (isNew && !code.trim())) return;
    try {
      if (isNew)
        await api.createCategory({
          code: code.trim().toUpperCase(),
          name: name.trim(),
        });
      else if (category)
        await api.updateCategory(category, { name: name.trim(), status });
      onChanged();
      onClose();
      showToast({ variant: 'success', title: tax('categorySaved') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: taxApiMessage(error, tax, 'categorySaveFailed'),
        });
    }
  };

  return (
    <DDialog
      open={category !== undefined}
      onClose={onClose}
      title={tax(isNew ? 'addCategory' : 'editCategory')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>{tax('cancel')}</DButton>
          <DButton onClick={() => void save()} disabled={!name.trim() || (isNew && !code.trim())}>
            {tax('save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew ? (
          <DInput label={tax('code')} value={code} onChange={(value) => setCode(value.toUpperCase())} />
        ) : (
          <DInput label={tax('code')} value={category?.code ?? ''} onChange={() => undefined} disabled />
        )}
        <DInput label={tax('name')} value={name} onChange={setName} />
        {!isNew ? (
          <DSelect
            label={tax('status')}
            value={status}
            clearable={false}
            options={[
              { value: 'ACTIVE', label: tax('active') },
              { value: 'INACTIVE', label: tax('inactive') },
            ]}
            onValueChange={(value) => setStatus(value as TaxCategory['status'])}
          />
        ) : null}
      </div>
    </DDialog>
  );
}

function TaxRulesSection({
  rules,
  categories,
  loading,
  canCreate,
  canCancel,
  api,
  onChanged,
}: {
  rules: TaxRule[];
  categories: TaxCategory[];
  loading: boolean;
  canCreate: boolean;
  canCancel: boolean;
  api: TaxApi;
  onChanged: () => void;
}) {
  const { tax, formatDate } = useTaxLocalization();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<TaxRule | null>(null);
  const categoryName = (id: string | null) =>
    id ? categories.find((category) => category.id === id)?.name ?? tax('noCategory') : tax('noCategory');
  const columns: TableColumn<TaxRule>[] = [
    { key: 'code', label: tax('code') },
    { key: 'name', label: tax('name') },
    {
      key: 'scope',
      label: tax('scope'),
      render: (row) => tax(row.scope === 'ITEM' ? 'item' : 'transaction'),
    },
    {
      key: 'taxCategoryId',
      label: tax('category'),
      render: (row) => categoryName(row.taxCategoryId),
    },
    {
      key: 'rate',
      label: tax('rate'),
      render: (row) => `${(Number(row.rate) * 100).toLocaleString()}%`,
    },
    {
      key: 'priceTreatment',
      label: tax('treatment'),
      render: (row) => tax(row.priceTreatment === 'INCLUDED' ? 'included' : 'excluded'),
    },
    {
      key: 'effectiveFrom',
      label: tax('effectivity'),
      render: (row) => formatEffectivity(row, tax, formatDate),
    },
    {
      key: 'cancelledAt',
      label: tax('status'),
      render: (row) => (
        <DBadge variant={row.cancelledAt ? 'secondary' : 'outline'}>
          {tax(row.cancelledAt ? 'cancelled' : 'active')}
        </DBadge>
      ),
    },
  ];

  const cancel = async () => {
    if (!cancelling) return;
    try {
      await api.cancelRule(cancelling.id);
      onChanged();
      setCancelling(null);
      showToast({ variant: 'success', title: tax('ruleCancelled') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: taxApiMessage(error, tax, 'ruleCancelFailed'),
        });
    }
  };

  return (
    <>
      <DDataTable
        columns={columns}
        data={rules}
        loading={loading}
        rowKey="id"
        emptyMessage={tax('ruleEmpty')}
        headerActions={
          canCreate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              {tax('addRule')}
            </DButton>
          ) : null
        }
        actions={
          canCancel
            ? [
                {
                  label: tax('cancelRule'),
                  icon: <Ban className="size-4" />,
                  variant: 'danger',
                  onClick: (row) => setCancelling(row),
                  show: (row) => !row.cancelledAt,
                },
              ]
            : []
        }
      />
      <TaxRuleDialog
        open={creating}
        categories={categories.filter((category) => category.status === 'ACTIVE')}
        api={api}
        onClose={() => setCreating(false)}
        onChanged={onChanged}
      />
      <DConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => void cancel()}
        title={tax('cancelRuleTitle')}
        message={tax('cancelRuleMessage')}
        confirmLabel={tax('cancelRule')}
        variant="danger"
      />
    </>
  );
}

function TaxRuleDialog({
  open,
  categories,
  api,
  onClose,
  onChanged,
}: {
  open: boolean;
  categories: TaxCategory[];
  api: TaxApi;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { tax } = useTaxLocalization();
  const { showToast } = useToast();
  const [scope, setScope] = useState<TaxRule['scope']>('TRANSACTION');
  const [categoryId, setCategoryId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ratePercent, setRatePercent] = useState('11');
  const [priceTreatment, setPriceTreatment] = useState<TaxRule['priceTreatment']>('EXCLUDED');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveUntil, setEffectiveUntil] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setScope('TRANSACTION');
    setCategoryId('');
    setCode('');
    setName('');
    setRatePercent('11');
    setPriceTreatment('EXCLUDED');
    setEffectiveFrom('');
    setEffectiveUntil('');
  }, [open]);

  const percent = Number(ratePercent);
  const periodInvalid = Boolean(
    effectiveFrom &&
      effectiveUntil &&
      new Date(effectiveUntil).getTime() <= new Date(effectiveFrom).getTime(),
  );
  const valid =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    ratePercent.trim().length > 0 &&
    Number.isFinite(percent) &&
    percent >= 0 &&
    percent <= 100 &&
    !periodInvalid &&
    (scope === 'TRANSACTION' || Boolean(categoryId));

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.createRule({
        scope,
        taxCategoryId: scope === 'ITEM' ? categoryId : null,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        rate: String(percent / 100),
        priceTreatment,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      });
      onChanged();
      onClose();
      showToast({ variant: 'success', title: tax('ruleAdded') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: taxApiMessage(error, tax, 'ruleAddFailed'),
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={tax('addRule')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>{tax('cancel')}</DButton>
          <DButton onClick={() => void save()} disabled={!valid || saving}>{tax('addRule')}</DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={tax('scope')}
          value={scope}
          clearable={false}
          options={[
            { value: 'TRANSACTION', label: tax('transaction') },
            { value: 'ITEM', label: tax('item') },
          ]}
          onValueChange={(value) => {
            setScope(value as TaxRule['scope']);
            if (value === 'TRANSACTION') setCategoryId('');
          }}
        />
        {scope === 'ITEM' ? (
          <DSelect
            label={tax('category')}
            value={categoryId}
            clearable={false}
            options={categories.map((category) => ({
              value: category.id,
              label: `${category.code} — ${category.name}`,
            }))}
            onValueChange={setCategoryId}
          />
        ) : null}
        <DInput label={tax('code')} value={code} onChange={(value) => setCode(value.toUpperCase())} />
        <DInput label={tax('name')} value={name} onChange={setName} />
        <DInput label={tax('rate')} inputMode="decimal" value={ratePercent} onChange={setRatePercent} />
        <DSelect
          label={tax('treatment')}
          value={priceTreatment}
          clearable={false}
          options={[
            { value: 'INCLUDED', label: tax('included') },
            { value: 'EXCLUDED', label: tax('excluded') },
          ]}
          onValueChange={(value) => setPriceTreatment(value as TaxRule['priceTreatment'])}
        />
        <DDatePicker
          label={`${tax('effectiveFrom')} (${tax('optional')})`}
          variant="date-time"
          value={effectiveFrom}
          onChange={setEffectiveFrom}
          onClear={() => setEffectiveFrom('')}
          clearable
        />
        <DDatePicker
          label={`${tax('effectiveUntil')} (${tax('optional')})`}
          variant="date-time"
          value={effectiveUntil}
          onChange={setEffectiveUntil}
          onClear={() => setEffectiveUntil('')}
          clearable
          error={periodInvalid ? tax('invalidPeriod') : undefined}
        />
      </div>
    </DDialog>
  );
}

function formatEffectivity(
  rule: TaxRule,
  tax: (key: TaxMessageKey) => string,
  formatDate: (value: Date, options?: Intl.DateTimeFormatOptions) => string,
) {
  const from = rule.effectiveFrom
    ? formatDate(new Date(rule.effectiveFrom), { dateStyle: 'medium', timeStyle: 'short' })
    : tax('immediate');
  const until = rule.effectiveUntil
    ? formatDate(new Date(rule.effectiveUntil), { dateStyle: 'medium', timeStyle: 'short' })
    : tax('noEnd');
  return `${from} → ${until}`;
}

function taxApiMessage(
  error: unknown,
  tax: (key: TaxMessageKey) => string,
  fallback: TaxMessageKey,
) {
  const normalized = normalizeBackofficeApiError(error);
  if (normalized.code === 'EFFECTIVE_PERIOD_OVERLAP') return tax('conflict');
  if (normalized.code === 'INACTIVE_REFERENCE') return tax('inactiveReference');
  if (normalized.code === 'DOMAIN_VALIDATION_ERROR' || normalized.code === 'BAD_REQUEST')
    return tax('invalidInput');
  if (normalized.code === 'FORBIDDEN' || normalized.status === 403) return tax('forbidden');
  if (normalized.code === 'SERVICE_UNAVAILABLE' || normalized.status === 503)
    return tax('serverError');
  return normalized.safeMessage || tax(fallback);
}
