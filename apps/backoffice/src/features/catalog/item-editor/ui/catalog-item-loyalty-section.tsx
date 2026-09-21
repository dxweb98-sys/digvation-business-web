import { DInput, DSelect } from '@digvation/ui';

import type { LoyaltyConfiguration, LoyaltyEarningRule } from '../../../../modules/loyalty/loyalty-api';
import { CatalogSection } from '../../ui/catalog-shared';
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
  const {
    behavior,
    pointsPerUnit,
    touched,
  } = editor.loyalty;
  const {
    setLoyaltyBehavior,
    setLoyaltyPointsPerUnit,
  } = editor.actions;

  return (
    <CatalogSection
      title="Loyalty"
      tone="secondary"
      description={
        loyaltyRule
          ? 'Aturan khusus ini dapat diubah antara poin khusus dan tidak dapat poin.'
          : 'Item ini mengikuti aturan default sampai aturan khusus disimpan.'
      }
    >
      {loading ? (
        <p className="text-sm text-(--color-text-muted)">Memuat aturan poin...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-(--color-text-muted)">Aturan poin</p>
              <p className="mt-1 font-medium">
                {loyaltyRule
                  ? loyaltyRule.behavior === 'FIXED'
                    ? 'Poin khusus'
                    : 'Tidak dapat poin'
                  : 'Mengikuti default'}
              </p>
            </div>
            <div>
              <p className="text-(--color-text-muted)">Hasil efektif</p>
              <p className="mt-1 font-medium">
                {(loyaltyRule?.behavior ?? configuration?.defaultEarningBehavior) === 'EXCLUDED'
                  ? 'Tidak dapat poin'
                  : `${loyaltyRule?.fixedPointsPerUnit ?? configuration?.defaultFixedPointsPerUnit ?? 0} poin / unit`}
              </p>
            </div>
          </div>

          {canConfigure ? (
            <div className="grid gap-4 sm:grid-cols-2">
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
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </CatalogSection>
  );
}
