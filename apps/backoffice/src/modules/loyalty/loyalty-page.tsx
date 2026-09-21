import { useRuntime } from '@digvation/business-runtime';
import {
  DBadge,
  DButton,
  DDataTable,
  DDialog,
  DInput,
  DSelect,
  DSkeleton,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { isSessionExpiredError, useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { CatalogApi, type CatalogManagementItem } from '../catalog/catalog-api';
import {
  LoyaltyApi,
  type LoyaltyConfiguration,
  type LoyaltyEarningBehavior,
  type LoyaltyEarningRule,
} from './loyalty-api';

const keys = {
  configuration: ['loyalty', 'configuration'] as const,
  rules: ['loyalty', 'earning-rules'] as const,
  catalog: (query: string) => ['loyalty', 'catalog', query] as const,
};
function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 sm:p-6">
      {children}
    </section>
  );
}
function pointsLabel(points: number | null | undefined) {
  return `${points ?? '0'} poin / unit`;
}
function effectiveRule(rule: LoyaltyEarningRule | undefined, configuration: LoyaltyConfiguration) {
  return (rule?.behavior ?? configuration.defaultEarningBehavior) === 'EXCLUDED'
    ? 'Tidak dapat poin'
    : pointsLabel(rule?.fixedPointsPerUnit ?? configuration.defaultFixedPointsPerUnit);
}

export function LoyaltyPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CatalogManagementItem | null>(null);
  const loyaltyApi = useMemo(
    () => new LoyaltyApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const catalogApi = useMemo(
    () => new CatalogApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const canConfigure = Boolean(session && canPerformBackofficeAction(session, 'configureLoyalty'));
  const configuration = useQuery({
    queryKey: keys.configuration,
    queryFn: () => loyaltyApi.getConfiguration(),
    enabled: Boolean(session),
  });
  const rules = useQuery({
    queryKey: keys.rules,
    queryFn: () => loyaltyApi.listEarningRules(),
    enabled: Boolean(session),
  });
  const catalog = useQuery({
    queryKey: keys.catalog(query),
    queryFn: () => catalogApi.listItems({ ...(query ? { q: query } : {}), limit: 50, offset: 0 }),
    enabled: Boolean(session),
  });
  if (!session) return null;
  const refreshConfiguration = () =>
    void queryClient.invalidateQueries({ queryKey: keys.configuration });
  const refreshRules = () => void queryClient.invalidateQueries({ queryKey: keys.rules });
  const ruleByCatalogItemId = new Map((rules.data ?? []).map((rule) => [rule.catalogItemId, rule]));
  const columns: TableColumn<CatalogManagementItem>[] = [
    {
      key: 'item',
      label: 'Produk / layanan',
      render: (item) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-(--color-text-muted)">{item.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Tipe',
      render: (item) => <DBadge variant="secondary">{item.type}</DBadge>,
    },
    {
      key: 'override',
      label: 'Aturan khusus',
      render: (item) => {
        const rule = ruleByCatalogItemId.get(item.id);
        return rule ? (
          rule.behavior === 'FIXED' ? (
            pointsLabel(rule.fixedPointsPerUnit)
          ) : (
            'Tidak dapat poin'
          )
        ) : (
          <span className="text-(--color-text-muted)">Mengikuti default</span>
        );
      },
    },
    {
      key: 'effective',
      label: 'Hasil efektif',
      render: (item) =>
        configuration.data
          ? effectiveRule(ruleByCatalogItemId.get(item.id), configuration.data)
          : '—',
    },
  ];
  const onError = (error: unknown, fallback: string) => {
    if (!isSessionExpiredError(error))
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(error, fallback).safeMessage,
      });
    void queryClient.invalidateQueries({ queryKey: keys.configuration });
    void queryClient.invalidateQueries({ queryKey: keys.rules });
  };
  const tableActions = canConfigure
    ? [
        {
          label: 'Atur poin',
          icon: <Pencil className="size-4" />,
          onClick: (item: CatalogManagementItem) => setEditing(item),
        },
      ]
    : [];
  const existingRule = editing ? ruleByCatalogItemId.get(editing.id) : undefined;
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow="Pengaturan"
        title="Loyalty"
        description="Atur nilai poin dan perolehan poin produk atau layanan."
      />
      <div className="mt-6 space-y-5">
        <ConfigurationSection
          {...(configuration.data ? { configuration: configuration.data } : {})}
          loading={configuration.isLoading}
          canConfigure={canConfigure}
          api={loyaltyApi}
          onChanged={refreshConfiguration}
          onError={(error) => onError(error, 'Tidak dapat menyimpan pengaturan Loyalty.')}
        />
        <Card>
          <div>
            <h2 className="font-semibold">Poin produk &amp; layanan</h2>
            <p className="mt-1 max-w-2xl text-sm text-(--color-text-muted)">
              Aturan khusus menggantikan aturan default. Item tanpa aturan khusus tetap mengikuti
              default.
            </p>
          </div>
          <div className="mt-5">
            <DDataTable
              columns={columns}
              data={catalog.data?.items ?? []}
              loading={catalog.isLoading || rules.isLoading || configuration.isLoading}
              rowKey="id"
              searchable
              searchPlaceholder="Cari nama atau kode produk/layanan..."
              searchValue={query}
              onSearchChange={setQuery}
              emptyMessage="Produk atau layanan tidak ditemukan."
              actions={tableActions}
            />
          </div>
        </Card>
      </div>
      {editing && configuration.data ? (
        <RuleDialog
          item={editing}
          {...(existingRule ? { rule: existingRule } : {})}
          api={loyaltyApi}
          onClose={() => setEditing(null)}
          onChanged={() => {
            refreshRules();
            setEditing(null);
          }}
          onError={(error) => onError(error, 'Tidak dapat menyimpan aturan poin.')}
        />
      ) : null}
    </BackofficePage>
  );
}

function ConfigurationSection({
  configuration,
  loading,
  canConfigure,
  api,
  onChanged,
  onError,
}: {
  configuration?: LoyaltyConfiguration;
  loading: boolean;
  canConfigure: boolean;
  api: LoyaltyApi;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pointValue, setPointValue] = useState('');
  const [behavior, setBehavior] = useState<LoyaltyEarningBehavior>('FIXED');
  const [pointsPerUnit, setPointsPerUnit] = useState('');
  const edit = () => {
    if (!configuration) return;
    setPointValue(configuration.pointValue ?? '');
    setBehavior(configuration.defaultEarningBehavior);
    setPointsPerUnit(String(configuration.defaultFixedPointsPerUnit));
    setOpen(true);
  };
  const points = Number(pointsPerUnit);
  const valid = pointValue.trim().length > 0 && Number.isInteger(points) && points >= 0;
  const save = async () => {
    if (!configuration || !valid || saving) return;
    setSaving(true);
    try {
      await api.updateConfiguration({
        expectedVersion: configuration.version,
        pointValue: pointValue.trim(),
        defaultEarningBehavior: behavior,
        defaultFixedPointsPerUnit: points,
      });
      onChanged();
      setOpen(false);
      showToast({ variant: 'success', title: 'Pengaturan Loyalty diperbarui.' });
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Nilai poin</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Nilai ini digunakan saat poin ditukarkan pada transaksi.
          </p>
        </div>
        {canConfigure && configuration ? (
          <DButton variant="secondary" size="sm" onClick={edit}>
            Ubah pengaturan
          </DButton>
        ) : null}
      </div>
      {loading ? (
        <DSkeleton className="mt-5 h-24" />
      ) : configuration ? (
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-(--color-text-muted)">1 poin</p>
            <p className="mt-1 text-lg font-semibold">
              = {configuration.pointValue ?? 'Belum diatur'} {configuration.currency}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Perolehan poin default</p>
            <p className="mt-1 font-semibold">
              {configuration.defaultEarningBehavior === 'FIXED' ? 'Dapat poin' : 'Tidak dapat poin'}
            </p>
            <p className="mt-1 text-(--color-text-muted)">
              {configuration.defaultEarningBehavior === 'FIXED'
                ? pointsLabel(configuration.defaultFixedPointsPerUnit)
                : 'Produk dan layanan secara default tidak menghasilkan poin kecuali memiliki aturan khusus.'}
            </p>
          </div>
        </div>
      ) : null}
      <DDialog
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Pengaturan Loyalty"
        description="Runtime menetapkan nilai dan aturan yang berlaku pada transaksi."
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Batal
            </DButton>
            <DButton onClick={() => void save()} loading={saving} disabled={!valid}>
              Simpan
            </DButton>
          </div>
        }
      >
        <div className="space-y-5">
          <DInput
            label={`1 poin = (${configuration?.currency ?? ''})`}
            inputMode="decimal"
            value={pointValue}
            onChange={setPointValue}
            hint="Nilai bisnis untuk satu poin."
          />
          <DSelect
            label="Perolehan poin default"
            value={behavior}
            clearable={false}
            options={[
              { value: 'FIXED', label: 'Dapat poin' },
              { value: 'EXCLUDED', label: 'Tidak dapat poin' },
            ]}
            onValueChange={(value) => {
              if (value === 'FIXED' || value === 'EXCLUDED') setBehavior(value);
            }}
          />
          {behavior === 'FIXED' ? (
            <DInput
              label="Poin per unit"
              inputMode="numeric"
              value={pointsPerUnit}
              onChange={setPointsPerUnit}
              hint="Jumlah poin untuk setiap unit produk atau layanan."
            />
          ) : (
            <p className="rounded-(--radius-control) bg-(--color-surface-muted) p-3 text-sm text-(--color-text-muted)">
              Produk dan layanan secara default tidak menghasilkan poin kecuali memiliki aturan
              khusus.
            </p>
          )}
        </div>
      </DDialog>
    </Card>
  );
}

function RuleDialog({
  item,
  rule,
  api,
  onClose,
  onChanged,
  onError,
}: {
  item: CatalogManagementItem;
  rule?: LoyaltyEarningRule;
  api: LoyaltyApi;
  onClose: () => void;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) {
  const { showToast } = useToast();
  const [behavior, setBehavior] = useState<LoyaltyEarningBehavior>(rule?.behavior ?? 'FIXED');
  const [pointsPerUnit, setPointsPerUnit] = useState<string>(
    String(rule?.fixedPointsPerUnit ?? ''),
  );
  const [saving, setSaving] = useState(false);
  const points = Number(pointsPerUnit);
  const valid = Number.isInteger(points) && points >= 0;
  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await api.updateEarningRule(item.id, {
        expectedVersion: rule?.version ?? 0,
        behavior,
        fixedPointsPerUnit: behavior === 'FIXED' ? points : 0,
      });
      showToast({ variant: 'success', title: 'Aturan poin diperbarui.' });
      onChanged();
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return (
    <DDialog
      open
      onClose={() => !saving && onClose()}
      title={`Atur poin: ${item.name}`}
      description={
        rule
          ? 'Aturan khusus ini dapat diubah. Runtime belum menyediakan aksi untuk mengembalikannya ke default.'
          : 'Aturan khusus ini hanya berlaku untuk produk atau layanan ini.'
      }
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose} disabled={saving}>
            Batal
          </DButton>
          <DButton onClick={() => void save()} loading={saving} disabled={!valid}>
            Simpan aturan
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        <DSelect
          label="Aturan poin"
          value={behavior}
          clearable={false}
          options={[
            { value: 'FIXED', label: 'Poin khusus' },
            { value: 'EXCLUDED', label: 'Tidak dapat poin' },
          ]}
          onValueChange={(value) => {
            if (value === 'FIXED' || value === 'EXCLUDED') setBehavior(value);
          }}
        />
        {behavior === 'FIXED' ? (
          <DInput
            label="Poin per unit"
            inputMode="numeric"
            value={pointsPerUnit}
            onChange={setPointsPerUnit}
          />
        ) : null}
      </div>
    </DDialog>
  );
}
