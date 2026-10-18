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
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
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
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await api.removeRule(removeTarget);
      showToast({ variant: 'success', title: 'Komisi produk dihapus.' });
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
        <span>
          <span className="block font-medium">{rule.itemName}</span>
          <span className="block text-xs text-(--color-text-muted)">{rule.itemCode}</span>
        </span>
      ),
    },
    {
      key: 'commissionPerUnit',
      label: 'Komisi',
      render: (rule) => commissionPerItemLabel(rule.commissionPerUnit, rule.currency),
    },
  ];

  return (
    <section className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 sm:p-6">
      <h2 className="text-base font-semibold text-(--color-text)">Komisi Produk</h2>
      <p className="mt-1 max-w-3xl text-sm text-(--color-text-muted)">
        Produk yang terdaftar di sini memberi komisi tetap per item kepada karyawan penjualnya saat
        transaksi selesai. Menghapus produk hanya menghentikan komisi transaksi berikutnya; komisi
        yang sudah tercatat tidak berubah.
      </p>

      <div className="mt-4">
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
                Tambah Produk
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
              label: 'Hapus komisi',
              icon: <Trash2 className="size-4" />,
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
        onClose={() => setRemoveTarget(null)}
        title="Hapus komisi produk?"
        footer={
          <div className="flex justify-end gap-2">
            <DButton variant="secondary" onClick={() => setRemoveTarget(null)}>
              Batal
            </DButton>
            <DButton variant="danger" loading={removing} onClick={() => void remove()}>
              Hapus
            </DButton>
          </div>
        }
      >
        <p className="text-sm text-(--color-text-muted)">
          {removeTarget
            ? `${removeTarget.itemName} tidak lagi memberi komisi pada transaksi berikutnya. Komisi yang sudah tercatat tidak berubah.`
            : ''}
        </p>
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
    if (!productId || error) return;
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

  return (
    <DDialog
      open
      onClose={onClose}
      title={rule ? `Ubah komisi ${rule.itemName}` : 'Tambah produk komisi'}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            Batal
          </DButton>
          <DButton loading={saving} disabled={!productId} onClick={() => void save()}>
            Simpan
          </DButton>
        </div>
      }
    >
      <div className="space-y-4">
        {rule ? null : (
          <DCombobox
            label="Produk"
            ariaLabel="Produk komisi"
            placeholder="Cari produk"
            options={options}
            value={productId}
            loading={products.isFetching}
            onSearchChange={setSearch}
            onChange={(value) => setProductId(value === null ? null : String(value))}
          />
        )}
        <DCurrencyInput
          label={`Komisi per item (${currency})`}
          value={amount}
          onValueChange={setAmount}
          placeholder="5000"
          error={touched ? (error ?? undefined) : undefined}
          hint="Nominal tetap per item terjual, dikalikan jumlah pada transaksi."
        />
      </div>
    </DDialog>
  );
}
