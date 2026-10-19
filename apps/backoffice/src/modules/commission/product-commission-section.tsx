import {
  DButton,
  DCombobox,
  DCurrencyInput,
  DDataTable,
  DDialog,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleOff, Package, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import { RecordDialogTitle, RecordPanel } from '../../shared/ui/record-dialog';
import type { ProductCommissionApi, ProductCommissionRule } from './product-commission-api';
import {
  commissionPerItemLabel,
  selectableProducts,
  trimCommissionAmount,
  validateCommissionAmount,
} from './product-commission-model';

const key = ['commission', 'product-rules'] as const;
const pageSize = 20;

export interface CommissionProductCandidate {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface Editor {
  /** The configuration being changed, or null when adding a Product. */
  rule: ProductCommissionRule | null;
}

/**
 * Product Commission configuration. A Product earns commission for future finalized Sales only
 * while it has a configuration row here: there is no enabled toggle. Removing a row never
 * changes commission that was already recorded.
 */
export function ProductCommissionSection({
  api,
  loadProducts,
  canConfigure,
}: {
  api: ProductCommissionApi;
  /** Catalog Product search; the surface itself never lists Services. */
  loadProducts: (q: string) => Promise<{ items: CommissionProductCandidate[] }>;
  canConfigure: boolean;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [offset, setOffset] = useState(0);
  const rules = useQuery({
    queryKey: [...key, offset],
    queryFn: () => api.listRules({ limit: pageSize, offset }),
  });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProductCommissionRule | null>(null);
  const [removing, setRemoving] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const fail = (error: unknown) => {
    if (isSessionExpiredError(error)) return;
    showToast({
      variant: 'danger',
      title: normalizeBackofficeApiError(error, 'Tidak dapat menyimpan komisi produk.').safeMessage,
    });
    refresh();
  };

  const remove = async () => {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await api.removeRule(removeTarget);
      showToast({ variant: 'success', title: 'Komisi produk dihentikan.' });
      setRemoveTarget(null);
      if ((rules.data?.items.length ?? 0) === 1 && offset > 0) setOffset(offset - pageSize);
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      setRemoving(false);
    }
  };

  const columns: TableColumn<ProductCommissionRule>[] = [
    {
      key: 'itemName',
      label: 'Produk',
      render: (rule) => (
        <div className="min-w-0">
          <p className="font-medium text-(--color-text)">{rule.itemName}</p>
          <p className="mt-0.5 font-mono text-xs text-(--color-text-muted)">{rule.itemCode}</p>
        </div>
      ),
    },
    {
      key: 'commissionPerUnit',
      label: 'Komisi per item',
      align: 'right',
      render: (rule) => (
        <span className="whitespace-nowrap tabular-nums">
          {commissionPerItemLabel(rule.commissionPerUnit, rule.currency)}
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Komisi produk" className="space-y-3">
      <header>
        <h2 className="text-sm font-semibold tracking-tight text-(--color-text)">Komisi produk</h2>
        <p className="mt-1 max-w-3xl text-sm text-(--color-text-muted)">
          Produk di daftar ini memberi komisi tetap per item kepada karyawan penjualnya saat
          transaksi selesai. Komisi yang sudah tercatat tidak berubah.
        </p>
      </header>

      <div>
        <DDataTable
          columns={columns}
          data={rules.data?.items ?? []}
          loading={rules.isLoading}
          rowKey="catalogItemId"
          emptyMessage="Belum ada produk dengan komisi."
          headerActions={
            canConfigure ? (
              <DButton
                leftIcon={<Plus className="size-4" />}
                onClick={() => setEditor({ rule: null })}
              >
                Tambah produk
              </DButton>
            ) : null
          }
          pagination={{
            page: Math.floor(offset / pageSize) + 1,
            pageSize,
            total: rules.data?.total ?? 0,
          }}
          onPageChange={(page) => setOffset((page - 1) * pageSize)}
          actions={[
            {
              label: 'Ubah nominal',
              icon: <Pencil className="size-4" />,
              onClick: (rule) => setEditor({ rule }),
              show: () => canConfigure,
            },
            {
              label: 'Hentikan komisi',
              icon: <CircleOff className="size-4" />,
              variant: 'danger',
              onClick: (rule) => setRemoveTarget(rule),
              show: () => canConfigure,
            },
          ]}
        />
      </div>

      {editor ? (
        <CommissionEditor
          key={editor.rule?.catalogItemId ?? 'new'}
          rule={editor.rule}
          configured={rules.data?.items ?? []}
          api={api}
          loadProducts={loadProducts}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            refresh();
          }}
          onError={fail}
        />
      ) : null}

      <DDialog
        open={removeTarget !== null}
        onClose={() => {
          if (!removing) setRemoveTarget(null);
        }}
        title={<RecordDialogTitle title="Hentikan komisi?" />}
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Batal
            </DButton>
            <DButton variant="danger" loading={removing} onClick={() => void remove()}>
              Hentikan komisi
            </DButton>
          </div>
        }
      >
        {removeTarget ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-(--color-surface-muted) px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <Package className="size-4 shrink-0 text-(--color-brand)" aria-hidden="true" />
                <ProductIdentity rule={removeTarget} />
              </div>
              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-(--color-text)">
                {commissionPerItemLabel(removeTarget.commissionPerUnit, removeTarget.currency)}
              </span>
            </div>
            <p
              role="note"
              className="flex gap-2 rounded-xl border border-[color-mix(in_srgb,var(--color-warning)_35%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-warning)_10%,var(--color-surface))] px-4 py-3 text-sm text-(--color-text)"
            >
              <CircleOff
                className="mt-0.5 size-4 shrink-0 text-(--color-warning)"
                aria-hidden="true"
              />
              <span>
                Komisi untuk produk ini tidak akan diberikan pada transaksi berikutnya. Komisi dari
                transaksi sebelumnya tetap tersimpan.
              </span>
            </p>
          </div>
        ) : null}
      </DDialog>
    </section>
  );
}

function CommissionEditor({
  rule,
  configured,
  api,
  loadProducts,
  onClose,
  onSaved,
  onError,
}: {
  rule: ProductCommissionRule | null;
  configured: readonly ProductCommissionRule[];
  api: ProductCommissionApi;
  loadProducts: (q: string) => Promise<{ items: CommissionProductCandidate[] }>;
  onClose: () => void;
  onSaved: () => void;
  onError: (error: unknown) => void;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState<string | null>(rule?.catalogItemId ?? null);
  const [amount, setAmount] = useState(trimCommissionAmount(rule?.commissionPerUnit));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const currency = rule?.currency ?? 'IDR';

  const products = useQuery({
    queryKey: ['commission', 'product-candidates', search],
    queryFn: () => loadProducts(search),
    enabled: rule === null,
  });
  const options = selectableProducts(products.data?.items ?? [], configured).map((product) => ({
    value: product.id,
    label: `${product.name} (${product.code})`,
  }));
  const error = validateCommissionAmount(amount);

  const save = async () => {
    setTouched(true);
    if (!productId || error || saving) return;
    setSaving(true);
    try {
      await api.setRule(productId, {
        expectedVersion: rule?.version ?? 0,
        commissionPerUnit: amount.trim(),
      });
      showToast({ variant: 'success', title: 'Komisi produk disimpan.' });
      onSaved();
    } catch (failure) {
      onError(failure);
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    if (!saving) onClose();
  };

  return (
    <DDialog
      open
      onClose={close}
      title={<RecordDialogTitle title={rule ? 'Ubah komisi produk' : 'Tambah produk komisi'} />}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={close} disabled={saving}>
            Batal
          </DButton>
          <DButton loading={saving} disabled={!productId} onClick={() => void save()}>
            Simpan
          </DButton>
        </div>
      }
    >
      <RecordPanel>
        {/* Product above amount: one column at every width. */}
        <div className="space-y-4">
          {rule ? (
            <div className="min-w-0">
              <p className="text-sm font-medium text-(--color-text)">Produk</p>
              <div
                className="mt-1.5 flex h-10 min-w-0 items-center gap-2 rounded-lg border border-(--color-border) bg-(--color-surface-muted) px-3"
                title={`${rule.itemName} (${rule.itemCode})`}
              >
                <Package className="size-4 shrink-0 text-(--color-brand)" aria-hidden="true" />
                <span className="min-w-0 truncate text-sm font-medium text-(--color-text)">
                  {rule.itemName}
                </span>
                <span className="shrink-0 font-mono text-xs text-(--color-text-muted)">
                  {rule.itemCode}
                </span>
              </div>
            </div>
          ) : (
            <DCombobox
              label="Produk"
              ariaLabel="Produk komisi"
              placeholder="Cari produk"
              options={options}
              value={productId}
              loading={products.isFetching}
              disabled={saving}
              onSearchChange={setSearch}
              onChange={(value) => setProductId(value === null ? null : String(value))}
            />
          )}
          <DCurrencyInput
            label={`Komisi per item (${currency})`}
            value={amount}
            onValueChange={setAmount}
            placeholder="5000"
            disabled={saving}
            error={touched ? (error ?? undefined) : undefined}
            hint="Nominal tetap per item terjual, dikalikan jumlah pada transaksi."
          />
        </div>
      </RecordPanel>
    </DDialog>
  );
}

function ProductIdentity({ rule }: { rule: ProductCommissionRule }) {
  return (
    <span className="block min-w-0">
      <span className="block break-words text-sm font-semibold text-(--color-text)">
        {rule.itemName}
      </span>
      <span className="mt-0.5 block font-mono text-xs font-normal text-(--color-text-muted)">
        {rule.itemCode}
      </span>
    </span>
  );
}
