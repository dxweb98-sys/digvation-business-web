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
  const followingDefault = !loyaltyRule && !touched;

  return (
    <section
      aria-label="Poin Loyalitas Member"
      className="border-t border-[var(--color-border)] pt-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Star className="size-4 text-[var(--color-brand)]" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Poin Loyalitas Member
            </h3>
            {!loading ? (
              <DBadge variant={followingDefault ? 'secondary' : 'info'}>
                {followingDefault ? 'Mengikuti default' : 'Aturan khusus'}
              </DBadge>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            {followingDefault
              ? effectiveBehavior === 'EXCLUDED'
                ? 'Default bisnis: item tidak memberikan poin.'
                : `Default bisnis: ${effectivePoints} poin per unit.`
              : 'Aturan khusus ini hanya berlaku untuk item ini.'}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">Memuat aturan poin...</p>
      ) : canConfigure ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              <p className="pb-2 text-xs leading-5 text-[var(--color-text-muted)]">
                Member tidak memperoleh poin dari item ini.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Anda memiliki akses baca untuk aturan Loyalty item ini.
        </p>
      )}
    </section>
  );
}
