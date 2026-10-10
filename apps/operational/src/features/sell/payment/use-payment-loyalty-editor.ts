import { createDecimal } from '@digvation/pos-money';
import { useToast } from '@digvation-labs/ui';
import { useEffect, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { cashierTransactionErrorMessage } from '../transaction/api/cashier-transaction-errors';
import type { Sale } from '../transaction/model/cashier-transaction.types';
import { wholePointValue } from '../transaction/model/sale-points';

/**
 * Member loyalty-point redemption while paying: the applied redemption and the points editor.
 * The editor closes whenever the payment dialog closes. Points are consumed by Runtime only when
 * the Sale is finalized.
 */
export function usePaymentLoyaltyEditor({
  open,
  locale,
  loyaltyRedemption,
  loyaltyPointBalance,
  loyaltyPoints,
  canRedeemLoyalty,
  isLoyaltyMutating,
  onLoyaltyPointsChange,
  onApplyLoyalty,
  onRemoveLoyalty,
}: {
  open: boolean;
  locale: string;
  loyaltyRedemption: Sale['loyaltyRedemption'];
  loyaltyPointBalance: string | null;
  loyaltyPoints: string;
  canRedeemLoyalty: boolean;
  isLoyaltyMutating: boolean;
  onLoyaltyPointsChange: (value: string) => void;
  onApplyLoyalty: (points: string) => Promise<unknown>;
  onRemoveLoyalty: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- accepted baseline: state is reset when its source changes; moving it to render-time derivation is a behavioural refactor tracked separately
    if (!open) setEditorOpen(false);
  }, [open]);
  const canonicalLoyaltyPoints = wholePointValue(loyaltyPoints);
  const validLoyaltyPointInput =
    canonicalLoyaltyPoints !== null &&
    createDecimal(canonicalLoyaltyPoints).greaterThan(createDecimal('0'));
  const canSubmit = canRedeemLoyalty && validLoyaltyPointInput && !isLoyaltyMutating;
  const legacyLoyaltyRedemption = loyaltyRedemption as
    | (NonNullable<Sale['loyaltyRedemption']> & {
        requestedPoints?: string;
        redemptionAmount?: string;
      })
    | null
    | undefined;
  const redeemedPoints =
    loyaltyRedemption?.points ?? legacyLoyaltyRedemption?.requestedPoints ?? null;
  const redeemedAmount =
    loyaltyRedemption?.amount ?? legacyLoyaltyRedemption?.redemptionAmount ?? null;
  const hasRedemption = Boolean(redeemedPoints && redeemedAmount);
  const wholePointBalance = wholePointValue(loyaltyPointBalance);
  const hasKnownPointBalance = wholePointBalance !== null;
  const pointBalancePositive =
    wholePointBalance !== null && createDecimal(wholePointBalance).greaterThan(createDecimal('0'));
  const apply = async () => {
    if (!canSubmit) return;
    try {
      if (
        hasKnownPointBalance &&
        createDecimal(canonicalLoyaltyPoints!).greaterThan(createDecimal(wholePointBalance!))
      ) {
        showToast({
          title: copy('Insufficient loyalty points'),
          description: copy('The requested points exceed the member point balance.'),
          variant: 'danger',
        });
        return;
      }
      await onApplyLoyalty(canonicalLoyaltyPoints!);
      setEditorOpen(false);
    } catch (error) {
      showToast({
        title: copy('Could not apply loyalty points'),
        description: cashierTransactionErrorMessage(error, locale),
        variant: 'danger',
      });
    }
  };
  const edit = () => {
    onLoyaltyPointsChange(wholePointValue(redeemedPoints) ?? '');
    setEditorOpen(true);
  };
  const start = () => {
    onLoyaltyPointsChange('');
    setEditorOpen(true);
  };
  const cancel = () => {
    onLoyaltyPointsChange('');
    setEditorOpen(false);
  };
  const remove = () => {
    setEditorOpen(false);
    onRemoveLoyalty();
  };
  return {
    editorOpen,
    canSubmit,
    redeemedPoints,
    redeemedAmount,
    hasRedemption,
    wholePointBalance,
    pointBalancePositive,
    apply,
    edit,
    start,
    cancel,
    remove,
  };
}

export type PaymentLoyaltyEditor = ReturnType<typeof usePaymentLoyaltyEditor>;
