import { DBadge, DInput, DSelect } from '@digvation/ui';
import { Star } from 'lucide-react';

import type {
  LoyaltyConfiguration,
  LoyaltyEarningRule,
} from '../../../../modules/loyalty/loyalty-api';
import { CatalogPanel, CatalogPanelHeader } from '../../ui/catalog-shared';
import type { useCatalogItemEditor } from '../model/use-catalog-item-editor';

type CatalogItemEditor = ReturnType<typeof useCatalogItemEditor>;

export function CatalogItemLoyaltySection({
  editor,
  loyaltyRule,
  configuration,
  loading,
  canConfigure,
  loyaltyDraftValid,
}: {
  editor: CatalogItemEditor;
  loyaltyRule: LoyaltyEarningRule | undefined;
  configuration: LoyaltyConfiguration | undefined;
  loading: boolean;
  canConfigure: boolean;
  loyaltyDraftValid: boolean;
}) {
  const { behavior, pointsPerUnit, touched } = editor.loyalty;
  const { setLoyaltyBehavior, setLoyaltyPointsPerUnit } = editor.actions;

  const effectiveBehavior = loyaltyRule?.behavior ?? configuration?.defaultEarningBehavior;
  const effectivePoints =
    loyaltyRule?.fixedPointsPerUnit ?? configuration?.defaultFixedPointsPerUnit ?? 0;
  const active = effectiveBehavior === 'FIXED';

  return (
    <CatalogPanel ariaLabel="Poin Loyalitas Member">
      <CatalogPanelHeader
        title="Poin Loyalitas Member"
        icon={<Star className="size-4" aria-hidden="true" />}
        description="Atur perilaku poin khusus item tanpa mengubah konfigurasi Loyalty bisnis."
        actions={
          loading ? null : (
            <DBadge variant={active ? 'success' : 'secondary'}>
              {active ? 'Aktif' : 'Nonaktif'}
            </DBadge>
          )
        }
      />
      <div className="p-5">
      {loading ? (
        <div className="rounded-xl border border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text-muted)]">
          Memuat aturan poin...
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 gap-2.5">
              <Star className="mt-0.5 size-4 shrink-0 text-[var(--color-brand)]" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  Poin loyalitas khusus item
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DBadge variant="secondary">
                    {loyaltyRule ? 'Aturan khusus' : 'Mengikuti default'}
                  </DBadge>
                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    {loyaltyRule
                      ? 'Item memiliki aturan poin tersendiri.'
                      : 'Aturan khusus baru disimpan jika Anda melakukan perubahan.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs text-[var(--color-text-muted)]">Hasil efektif</p>
              <p className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
                {active ? `${effectivePoints} poin / unit` : 'Tidak dapat poin'}
              </p>
            </div>
          </div>

          {canConfigure ? (
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
              <DSelect
                label="Aturan poin"
                value={behavior}
                clearable={false}
                options={[
                  { value: 'FIXED', label: 'Poin khusus' },
                  { value: 'EXCLUDED', label: 'Tidak dapat poin' },
                ]}
                onChange={(value) => {
                  if (value === 'FIXED' || value === 'EXCLUDED') {
                    setLoyaltyBehavior(value);
                  }
                }}
              />
              {behavior === 'FIXED' ? (
                <DInput
                  label="Poin per unit"
                  inputMode="numeric"
                  value={pointsPerUnit}
                  onChange={setLoyaltyPointsPerUnit}
                  error={
                    touched && !loyaltyDraftValid
                      ? 'Gunakan angka bulat nol atau lebih.'
                      : undefined
                  }
                />
              ) : (
                <div className="flex items-end">
                  <p className="pb-2 text-xs text-[var(--color-text-muted)]">
                    Member tidak memperoleh poin dari item ini.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
              Anda memiliki akses baca untuk aturan Loyalty item ini.
            </div>
          )}
        </div>
      )}
      </div>
    </CatalogPanel>
  );
}
