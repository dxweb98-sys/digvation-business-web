import { DInput, DSelect } from '@digvation/ui';
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
  const followingDefault = !loyaltyRule && !touched;

  return (
    <section
      aria-label="Poin Loyalitas Member"
      className="mt-5 border-t border-[var(--color-border)] pt-5"
    >
      <div className="flex items-center gap-2">
        <Star className="size-4 text-[var(--color-brand)]" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">
          Poin Loyalitas Member
        </h3>
      </div>

      <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
        {loading
          ? 'Memuat aturan poin...'
          : followingDefault
            ? effectiveBehavior === 'EXCLUDED'
              ? 'Mengikuti default bisnis: tidak dapat poin.'
              : `Mengikuti default bisnis: ${effectivePoints} poin per unit.`
            : 'Menggunakan aturan khusus untuk item ini.'}
      </p>

      {!loading && canConfigure ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DSelect
            label="Perolehan poin"
            value={behavior}
            clearable={false}
            options={[
              { value: 'FIXED', label: 'Dapat poin' },
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
          ) : null}
        </div>
      ) : !loading ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Hanya dapat dilihat.
        </p>
      ) : null}
    </section>
  );
}
