import {
  DButton,
  DCurrencyInput,
  DDialog,
  DInput,
  DRadio,
  DSelect,
  DSkeleton,
  DToggle,
  useToast,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { LoyaltyApi, LoyaltyEarningMode } from './loyalty-api';
import {
  draftFromConfiguration,
  transactionEarningExample,
  updateInputFromDraft,
  validateDraft,
  type LoyaltyConfigurationDraft,
} from './loyalty-configuration-model';

const key = ['loyalty', 'configuration'] as const;

function Card({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-(--radius-card) border border-(--color-border) bg-(--color-surface) p-5 sm:p-6">
      {children}
    </section>
  );
}

function pointsLabel(points: number) {
  return `${points} poin / unit`;
}

const modeCopy: Record<LoyaltyEarningMode, { label: string; description: string }> = {
  PER_ITEM: {
    label: 'Per Item',
    description: 'Poin dihitung dari setiap produk atau layanan sesuai aturan poin per unit.',
  },
  TRANSACTION_TOTAL: {
    label: 'Berdasarkan Total Transaksi',
    description: 'Poin dihitung dari total transaksi, per kelipatan nominal tertentu.',
  },
};

function formatStep(amount: string, currency: string): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 })
    .format(Number(amount))
    .replace(/[\u00a0\u202f]/g, '');
}

export function LoyaltyConfigurationSection({
  api,
  canConfigure,
}: {
  api: LoyaltyApi;
  canConfigure: boolean;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const configuration = useQuery({ queryKey: key, queryFn: () => api.getConfiguration() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<LoyaltyConfigurationDraft | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const currency = configuration.data?.currency ?? '';

  const edit = () => {
    const current = configuration.data;
    if (!current) return;
    setDraft(draftFromConfiguration(current));
    setTouched(new Set());
    setOpen(true);
  };
  const change = <K extends keyof LoyaltyConfigurationDraft>(
    field: K,
    value: LoyaltyConfigurationDraft[K],
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setTouched((current) => new Set(current).add(field));
  };

  const errors = draft ? validateDraft(draft) : {};
  const valid = draft !== null && Object.keys(errors).length === 0;
  const shown = (field: keyof typeof errors) => (touched.has(field) ? errors[field] : undefined);
  const example =
    draft && draft.earningMode === 'TRANSACTION_TOTAL'
      ? transactionEarningExample({
          amountPerStep: draft.amountPerStep,
          pointsPerStep: draft.pointsPerStep,
          currency,
        })
      : null;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const save = async () => {
    const current = configuration.data;
    if (!current || !draft || !valid || saving) return;
    setSaving(true);
    try {
      await api.updateConfiguration(updateInputFromDraft(draft, current.version));
      refresh();
      setOpen(false);
      showToast({ variant: 'success', title: 'Pengaturan Loyalty diperbarui.' });
    } catch (error) {
      if (!isSessionExpiredError(error))
        showToast({
          variant: 'danger',
          title: normalizeBackofficeApiError(error, 'Tidak dapat menyimpan pengaturan Loyalty.')
            .safeMessage,
        });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const data = configuration.data;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Pengaturan poin</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Nilai penukaran poin dan cara pelanggan mendapatkan poin.
          </p>
        </div>
        {canConfigure && data ? (
          <DButton variant="secondary" size="sm" onClick={edit}>
            Ubah pengaturan
          </DButton>
        ) : null}
      </div>
      {configuration.isLoading ? (
        <DSkeleton className="mt-5 h-24" />
      ) : data ? (
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-3">
          <div>
            <p className="text-(--color-text-muted)">Nilai poin saat ditukarkan</p>
            <p className="mt-1 text-lg font-semibold">
              1 poin = {data.pointValue ?? 'Belum diatur'} {data.currency}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Cara mendapatkan poin</p>
            <p className="mt-1 font-semibold">{modeCopy[data.earningMode].label}</p>
            <p className="mt-1 text-(--color-text-muted)">
              {data.earningMode === 'TRANSACTION_TOTAL'
                ? data.transactionAmountPerStep && data.transactionPointsPerStep
                  ? `Setiap ${formatStep(data.transactionAmountPerStep, data.currency)} → ${data.transactionPointsPerStep} poin`
                  : 'Belum diatur'
                : data.defaultEarningBehavior === 'FIXED'
                  ? `Default: ${pointsLabel(data.defaultFixedPointsPerUnit)}`
                  : 'Default: tidak dapat poin kecuali ada aturan khusus per item.'}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Saat transaksi menggunakan poin</p>
            <p className="mt-1 font-semibold">
              {data.earnWhileRedeemingPolicy === 'EARN_WHEN_REDEEMING'
                ? 'Tetap dapat poin'
                : 'Tidak dapat poin baru'}
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
        {draft ? (
          <div className="space-y-5">
            <DCurrencyInput
              label={`1 poin = (${currency})`}
              value={draft.pointValue}
              onValueChange={(value) => change('pointValue', value)}
              error={shown('pointValue')}
              hint="Nilai saat poin ditukarkan pada transaksi. Terpisah dari cara mendapatkan poin."
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Cara Mendapatkan Poin</legend>
              {(Object.keys(modeCopy) as LoyaltyEarningMode[]).map((mode) => {
                const checked = draft.earningMode === mode;
                return (
                  <label
                    key={mode}
                    className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
                      checked
                        ? 'border-(--color-brand) bg-(--color-brand)/[0.035] shadow-[inset_0_0_0_1px_var(--color-brand)]'
                        : 'border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-muted)/50'
                    }`}
                  >
                    <DRadio
                      name="loyalty-earning-mode"
                      value={mode}
                      checked={checked}
                      onChange={() => change('earningMode', mode)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{modeCopy[mode].label}</span>
                      <span className="mt-1 block text-xs leading-5 text-(--color-text-muted)">
                        {modeCopy[mode].description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {draft.earningMode === 'PER_ITEM' ? (
              <div className="space-y-5">
                <DSelect
                  label="Perolehan poin default"
                  value={draft.behavior}
                  clearable={false}
                  options={[
                    { value: 'FIXED', label: 'Dapat poin' },
                    { value: 'EXCLUDED', label: 'Tidak dapat poin' },
                  ]}
                  onValueChange={(value) => {
                    if (value === 'FIXED' || value === 'EXCLUDED') change('behavior', value);
                  }}
                />
                {draft.behavior === 'FIXED' ? (
                  <DInput
                    label="Poin per unit"
                    inputMode="numeric"
                    value={draft.pointsPerUnit}
                    onChange={(value) => change('pointsPerUnit', value)}
                    error={shown('pointsPerUnit')}
                    hint="Jumlah poin untuk setiap unit produk atau layanan."
                  />
                ) : (
                  <p className="rounded-(--radius-control) bg-(--color-surface-muted) p-3 text-sm text-(--color-text-muted)">
                    Produk dan layanan secara default tidak menghasilkan poin kecuali memiliki
                    aturan khusus.
                  </p>
                )}
                <p className="text-xs text-(--color-text-muted)">
                  Aturan poin khusus untuk tiap item tetap diatur di Katalog dan tidak berubah saat
                  Anda berpindah cara.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <DCurrencyInput
                  label="Nominal transaksi per langkah"
                  value={draft.amountPerStep}
                  onValueChange={(value) => change('amountPerStep', value)}
                  placeholder="200000"
                  error={shown('amountPerStep')}
                  hint={`Dalam ${currency}. Setiap kelipatan nominal ini menghasilkan poin.`}
                />
                <DInput
                  label="Poin per langkah"
                  inputMode="numeric"
                  value={draft.pointsPerStep}
                  onChange={(value) => change('pointsPerStep', value)}
                  placeholder="1"
                  error={shown('pointsPerStep')}
                  hint="Poin yang didapat untuk setiap kelipatan."
                />
                {example ? (
                  <div
                    className="rounded-(--radius-control) border border-(--color-brand)/20 bg-(--color-brand)/5 p-3 text-sm"
                    aria-label="Contoh perolehan poin"
                  >
                    <p className="font-semibold">{example.rule}</p>
                    {example.multiple ? (
                      <p className="mt-1 text-(--color-text-muted)">Contoh: {example.multiple}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-(--color-text-muted)">
                      Kelipatan penuh saja, sisa nominal tidak dihitung. Nilai transaksi dihitung
                      sebelum pajak dan sebelum penukaran poin, setelah promo dan diskon.
                    </p>
                  </div>
                ) : null}
                <p className="text-xs text-(--color-text-muted)">
                  Aturan poin per item tetap tersimpan di Katalog, tetapi tidak dipakai selama cara
                  ini aktif.
                </p>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 rounded-xl border border-(--color-border) p-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Tetap dapat poin saat menggunakan poin</p>
                <p className="mt-1 text-xs leading-5 text-(--color-text-muted)">
                  {draft.earnWhileRedeeming
                    ? 'Aktif: menukarkan poin tidak menghalangi transaksi mendapatkan poin baru.'
                    : 'Nonaktif: transaksi yang menggunakan poin tidak mendapatkan poin baru.'}
                </p>
              </div>
              <DToggle
                checked={draft.earnWhileRedeeming}
                onChange={(checked) => change('earnWhileRedeeming', checked)}
                ariaLabel="Tetap dapat poin saat menggunakan poin"
              />
            </div>
          </div>
        ) : null}
      </DDialog>
    </Card>
  );
}
