import { DButton, DDialog, DInput, DSelect, DSkeleton, useToast } from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../auth/backoffice-auth-context';
import type { LoyaltyApi, LoyaltyEarningBehavior } from './loyalty-api';

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
  const [pointValue, setPointValue] = useState('');
  const [behavior, setBehavior] = useState<LoyaltyEarningBehavior>('FIXED');
  const [pointsPerUnit, setPointsPerUnit] = useState('');
  const edit = () => {
    const current = configuration.data;
    if (!current) return;
    setPointValue(current.pointValue ?? '');
    setBehavior(current.defaultEarningBehavior);
    setPointsPerUnit(String(current.defaultFixedPointsPerUnit));
    setOpen(true);
  };
  const points = Number(pointsPerUnit);
  const valid = pointValue.trim().length > 0 && Number.isInteger(points) && points >= 0;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: key });
  const save = async () => {
    const current = configuration.data;
    if (!current || !valid || saving) return;
    setSaving(true);
    try {
      await api.updateConfiguration({
        expectedVersion: current.version,
        pointValue: pointValue.trim(),
        defaultEarningBehavior: behavior,
        defaultFixedPointsPerUnit: points,
      });
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
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Nilai poin</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Nilai ini digunakan saat poin ditukarkan pada transaksi.
          </p>
        </div>
        {canConfigure && configuration.data ? (
          <DButton variant="secondary" size="sm" onClick={edit}>
            Ubah pengaturan
          </DButton>
        ) : null}
      </div>
      {configuration.isLoading ? (
        <DSkeleton className="mt-5 h-24" />
      ) : configuration.data ? (
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-(--color-text-muted)">1 poin</p>
            <p className="mt-1 text-lg font-semibold">
              = {configuration.data.pointValue ?? 'Belum diatur'} {configuration.data.currency}
            </p>
          </div>
          <div>
            <p className="text-(--color-text-muted)">Perolehan poin default</p>
            <p className="mt-1 font-semibold">
              {configuration.data.defaultEarningBehavior === 'FIXED'
                ? 'Dapat poin'
                : 'Tidak dapat poin'}
            </p>
            <p className="mt-1 text-(--color-text-muted)">
              {configuration.data.defaultEarningBehavior === 'FIXED'
                ? pointsLabel(configuration.data.defaultFixedPointsPerUnit)
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
            label={`1 poin = (${configuration.data?.currency ?? ''})`}
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
