import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DCheckbox,
  DConfirmDialog,
  DDataTable,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
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
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import {
  isSessionExpiredError,
  useBackofficeAuth,
} from '../../auth/backoffice-auth-context';
import { TaxApi, type TaxCategory, type TaxProfile, type TaxRule } from './tax-api';

const keys = {
  profile: ['tax', 'profile'] as const,
  categories: ['tax', 'categories'] as const,
  rules: ['tax', 'rules'] as const,
};

export function TaxPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const queryClient = useQueryClient();
  const { copy } = useBackofficeLocalization();
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
        description={copy(
          'Configure the existing Runtime tax profile, categories, and effective rules. Historical Sale tax facts remain unchanged.',
        )}
      />

      <DTabs defaultValue="profile" className="mt-6">
        <DTabsList>
          <DTabsTrigger value="profile">{copy('Profile')}</DTabsTrigger>
          <DTabsTrigger value="categories">{copy('Categories')}</DTabsTrigger>
          <DTabsTrigger value="rules">{copy('Effective rules')}</DTabsTrigger>
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

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
      {children}
    </section>
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
  const { copy } = useBackofficeLocalization();
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
      showToast({ variant: 'success', title: copy('Tax profile updated.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not update tax profile.')).safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <Panel>
        <DSkeleton className="h-28" />
      </Panel>
    );

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{copy('Tax profile')}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {copy('Enable only the tax scopes this business actually uses.')}
          </p>
        </div>
        {canUpdate && profile ? (
          <DButton onClick={() => void save()} disabled={saving}>
            {copy('Save profile')}
          </DButton>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-4">
          <DCheckbox
            checked={itemTaxEnabled}
            onChange={() => setItemTaxEnabled((value) => !value)}
            disabled={!canUpdate}
          />
          <span>
            <span className="block font-medium">{copy('Item tax')}</span>
            <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
              {copy('Allows item-category tax rules to be resolved for catalog lines.')}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] p-4">
          <DCheckbox
            checked={transactionTaxEnabled}
            onChange={() => setTransactionTaxEnabled((value) => !value)}
            disabled={!canUpdate}
          />
          <span>
            <span className="block font-medium">{copy('Transaction tax')}</span>
            <span className="mt-1 block text-sm text-[var(--color-text-muted)]">
              {copy('Allows the active transaction-level tax rule to be resolved.')}
            </span>
          </span>
        </label>
      </div>
    </Panel>
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
  const { copy } = useBackofficeLocalization();
  const [editing, setEditing] = useState<TaxCategory | null | undefined>();
  const columns: TableColumn<TaxCategory>[] = [
    { key: 'code', label: copy('Code') },
    { key: 'name', label: copy('Name') },
    {
      key: 'status',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={row.status === 'ACTIVE' ? 'outline' : 'secondary'}>
          {copy(row.status === 'ACTIVE' ? 'Active' : 'Inactive')}
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
        emptyMessage={copy('No tax categories have been configured yet.')}
        headerActions={
          canCreate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setEditing(null)}>
              {copy('Add category')}
            </DButton>
          ) : null
        }
        actions={
          canUpdate
            ? [
                {
                  label: copy('Edit category'),
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
  const { copy } = useBackofficeLocalization();
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
      showToast({ variant: 'success', title: copy('Tax category saved.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not save tax category.')).safeMessage,
        });
    }
  };

  return (
    <DDialog
      open={category !== undefined}
      onClose={onClose}
      title={copy(isNew ? 'Add tax category' : 'Edit tax category')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>{copy('Cancel')}</DButton>
          <DButton onClick={() => void save()} disabled={!name.trim() || (isNew && !code.trim())}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {isNew ? (
          <DInput label={copy('Code')} value={code} onChange={(value) => setCode(value.toUpperCase())} />
        ) : (
          <DInput label={copy('Code')} value={category?.code ?? ''} onChange={() => undefined} disabled />
        )}
        <DInput label={copy('Name')} value={name} onChange={setName} />
        {!isNew ? (
          <DSelect
            label={copy('Status')}
            value={status}
            clearable={false}
            options={[
              { value: 'ACTIVE', label: copy('Active') },
              { value: 'INACTIVE', label: copy('Inactive') },
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
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<TaxRule | null>(null);
  const categoryName = (id: string | null) =>
    id ? categories.find((category) => category.id === id)?.name ?? '—' : '—';
  const columns: TableColumn<TaxRule>[] = [
    { key: 'code', label: copy('Code') },
    { key: 'name', label: copy('Name') },
    { key: 'scope', label: copy('Scope') },
    {
      key: 'taxCategoryId',
      label: copy('Category'),
      render: (row) => categoryName(row.taxCategoryId),
    },
    {
      key: 'rate',
      label: copy('Rate'),
      render: (row) => `${(Number(row.rate) * 100).toLocaleString()}%`,
    },
    {
      key: 'priceTreatment',
      label: copy('Price treatment'),
      render: (row) => copy(row.priceTreatment === 'INCLUDED' ? 'Inclusive' : 'Exclusive'),
    },
    {
      key: 'effectiveFrom',
      label: copy('Effective from'),
      render: (row) => new Date(row.effectiveFrom).toLocaleString(),
    },
    {
      key: 'cancelledAt',
      label: copy('Status'),
      render: (row) => (
        <DBadge variant={row.cancelledAt ? 'secondary' : 'outline'}>
          {copy(row.cancelledAt ? 'Cancelled' : 'Active')}
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
      showToast({ variant: 'success', title: copy('Tax rule cancelled.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not cancel tax rule.')).safeMessage,
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
        emptyMessage={copy('No effective tax rules have been configured yet.')}
        headerActions={
          canCreate ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              {copy('Add rule')}
            </DButton>
          ) : null
        }
        actions={
          canCancel
            ? [
                {
                  label: copy('Cancel rule'),
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
        title={copy('Cancel tax rule?')}
        message={copy('Historical Sale tax facts remain unchanged. The rule will no longer resolve for future effective calculations.')}
        confirmLabel={copy('Cancel rule')}
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
  const { copy } = useBackofficeLocalization();
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
    const now = new Date();
    now.setSeconds(0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    setScope('TRANSACTION');
    setCategoryId('');
    setCode('');
    setName('');
    setRatePercent('11');
    setPriceTreatment('EXCLUDED');
    setEffectiveFrom(local);
    setEffectiveUntil('');
  }, [open]);

  const percent = Number(ratePercent);
  const valid =
    code.trim().length > 0 &&
    name.trim().length > 0 &&
    Number.isFinite(percent) &&
    percent >= 0 &&
    percent <= 100 &&
    Boolean(effectiveFrom) &&
    (scope === 'TRANSACTION' || Boolean(categoryId));

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const fraction = String(percent / 100);
      await api.createRule({
        scope,
        taxCategoryId: scope === 'ITEM' ? categoryId : null,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        rate: fraction,
        priceTreatment,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveUntil: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      });
      onChanged();
      onClose();
      showToast({ variant: 'success', title: copy('Tax rule added.') });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, copy('Could not add tax rule.')).safeMessage,
        });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Add tax rule')}
      description={copy('Rules are append-only effective history. Existing rules are cancelled, not edited in place.')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>{copy('Cancel')}</DButton>
          <DButton onClick={() => void save()} disabled={!valid || saving}>{copy('Add rule')}</DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={copy('Scope')}
          value={scope}
          clearable={false}
          options={[
            { value: 'TRANSACTION', label: copy('Transaction') },
            { value: 'ITEM', label: copy('Item') },
          ]}
          onValueChange={(value) => setScope(value as TaxRule['scope'])}
        />
        {scope === 'ITEM' ? (
          <DSelect
            label={copy('Category')}
            value={categoryId}
            clearable={false}
            options={categories.map((category) => ({ value: category.id, label: `${category.code} — ${category.name}` }))}
            onValueChange={setCategoryId}
          />
        ) : null}
        <DInput label={copy('Code')} value={code} onChange={(value) => setCode(value.toUpperCase())} />
        <DInput label={copy('Name')} value={name} onChange={setName} />
        <DInput label={copy('Rate (%)')} value={ratePercent} onChange={setRatePercent} />
        <DSelect
          label={copy('Price treatment')}
          value={priceTreatment}
          clearable={false}
          options={[
            { value: 'INCLUDED', label: copy('Inclusive') },
            { value: 'EXCLUDED', label: copy('Exclusive') },
          ]}
          onValueChange={(value) => setPriceTreatment(value as TaxRule['priceTreatment'])}
        />
        <DInput label={copy('Effective from')} type="datetime-local" value={effectiveFrom} onChange={setEffectiveFrom} />
        <DInput label={copy('Effective until (optional)')} type="datetime-local" value={effectiveUntil} onChange={setEffectiveUntil} />
      </div>
    </DDialog>
  );
}
