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
import { Coins, Gift, Pencil, Repeat, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
} from '../../shared/ui/record-dialog';
import type { LoyaltyApi, LoyaltyEarningMode } from './loyalty-api';
import {
  draftFromConfiguration,
  formatLoyaltyMoney,
  transactionEarningExample,
  updateInputFromDraft,
  validateDraft,
  type LoyaltyConfigurationDraft,
} from './loyalty-configuration-model';

const key = ['loyalty', 'configuration'] as const;

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
    <RecordPanel padded={false} ariaLabel="Pengaturan poin">
      <RecordPanelHeader
        title="Pengaturan poin"
        trailing={
          canConfigure && data ? (
            <DButton
              variant="secondary"
              size="sm"
              leftIcon={<Pencil className="size-4" />}
              onClick={edit}
            >
              Ubah pengaturan
            </DButton>
          ) : null
        }
      />
      <RecordPanelBody>
        <p className="text-sm text-(--color-text-muted)">
          Nilai penukaran poin dan cara pelanggan mendapatkan poin.
        </p>
        {configuration.isLoading ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2" role="status" aria-busy="true">
            {[0, 1, 2, 3].map((tile) => (
              <DSkeleton key={tile} height={68} rounded="lg" />
            ))}
          </div>
        ) : data ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label="Nilai penukaran poin"
              icon={<Coins className="size-3.5" aria-hidden="true" />}
              value={
                data.pointValue
                  ? `1 poin = ${formatLoyaltyMoney(data.pointValue, data.currency)}`
                  : null
              }
            />
            <RecordInfoTile
              label="Cara mendapatkan poin"
              icon={<Sparkles className="size-3.5" aria-hidden="true" />}
              value={
                <>
                  {modeCopy[data.earningMode].label}
                  <span className="mt-0.5 block text-xs font-normal text-(--color-text-muted)">
                    {modeCopy[data.earningMode].description}
                  </span>
                </>
              }
            />
            <RecordInfoTile
              label={
                data.earningMode === 'TRANSACTION_TOTAL'
                  ? 'Perolehan poin per transaksi'
                  : 'Perolehan poin default'
              }
              icon={<Gift className="size-3.5" aria-hidden="true" />}
              value={
                data.earningMode === 'TRANSACTION_TOTAL'
                  ? data.transactionAmountPerStep && data.transactionPointsPerStep
                    ? `Setiap ${formatLoyaltyMoney(data.transactionAmountPerStep, data.currency)} → ${data.transactionPointsPerStep} poin`
                    : null
                  : data.defaultEarningBehavior === 'FIXED'
                    ? pointsLabel(data.defaultFixedPointsPerUnit)
                    : 'Tidak dapat poin kecuali ada aturan khusus per item'
              }
            />
            <RecordInfoTile
              label="Saat transaksi menggunakan poin"
              icon={<Repeat className="size-3.5" aria-hidden="true" />}
              value={
                data.earnWhileRedeemingPolicy === 'EARN_WHEN_REDEEMING'
                  ? 'Tetap dapat poin'
                  : 'Tidak dapat poin baru'
              }
            />
          </div>
        ) : null}
      </RecordPanelBody>
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
    </RecordPanel>
  );
}
