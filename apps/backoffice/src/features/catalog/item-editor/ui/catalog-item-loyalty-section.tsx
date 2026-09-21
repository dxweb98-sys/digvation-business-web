import { DBadge, DInput, DSelect } from '@digvation/ui';
import { Star } from 'lucide-react';

import type {
  LoyaltyConfiguration,
  LoyaltyEarningRule,
} from '../../../../modules/loyalty/loyalty-api';
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
    <section
      aria-label="Poin Loyalitas Member"
      className="min-w-0 rounded-xl border border-[var(--color-brand)]/20 bg-[var(--color-brand)]/[0.035] p-3.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
          <Star className="size-3.5 text-[var(--color-brand)]" aria-hidden="true" />
          <span>Poin Loyalitas Member</span>
        </div>
        {!loading ? (
          <DBadge variant={active ? 'success' : 'secondary'}>
            {active ? 'Aktif' : 'Nonaktif'}
          </DBadge>
        ) : null}
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Memuat aturan poin...</p>
      ) : (
        <>
          <div className="mt-2">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {active ? `${effectivePoints} poin / unit` : 'Tidak dapat poin'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <DBadge variant="secondary">
                {loyaltyRule ? 'Aturan khusus' : 'Mengikuti default'}
              </DBadge>
            </div>
          </div>

          {canConfigure ? (
            <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
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
                <p className="text-xs text-[var(--color-text-muted)]">
                  Member tidak memperoleh poin dari item ini.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[11px] leading-4 text-[var(--color-text-muted)]">
              Anda memiliki akses baca untuk aturan Loyalty item ini.
            </p>
          )}
        </>
      )}
    </section>
  );
}
