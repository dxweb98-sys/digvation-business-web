import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { PosCurrencyInput } from '../lib/pos-controls';
import type { PaymentIntent } from '../transaction/model/sale-presentation';
import { PaymentIntentHint } from './payment-confirmation';
import type { PaymentAllocationMode } from './payment-dialog-state';

type Format = (amount: string) => string;

/**
 * How much of the remaining balance this payment covers: all of it, or an explicitly chosen part.
 * `partialLabel` names the partial choice in the caller's context.
 */
export function PaymentAllocationTabs({
  allocationMode,
  onAllocationModeChange,
  remainingAmount,
  appliedAmount,
  onAppliedAmount,
  amountScale,
  overAllocated,
  intent,
  onPayRemaining,
  partialLabel,
  format,
}: {
  allocationMode: PaymentAllocationMode;
  onAllocationModeChange: (mode: PaymentAllocationMode) => void;
  remainingAmount: string;
  appliedAmount: string;
  onAppliedAmount: (amount: string) => void;
  amountScale: number;
  overAllocated: boolean;
  intent: PaymentIntent;
  onPayRemaining: () => void;
  partialLabel: string;
  format: Format;
}) {
  const { copy } = useOperationalLocalization();
  return (
    <DTabs
      value={allocationMode}
      defaultValue="FULL"
      onValueChange={(value) => onAllocationModeChange(value as PaymentAllocationMode)}
    >
      <DTabsList className="grid w-full grid-cols-2 rounded-xl bg-[var(--color-surface-muted)] p-1">
        <DTabsTrigger value="FULL" className="h-9 min-w-0 px-3 text-sm font-semibold">
          {copy('Full payment')}
        </DTabsTrigger>
        <DTabsTrigger value="SPLIT" className="h-9 min-w-0 px-3 text-sm font-semibold">
          {partialLabel}
        </DTabsTrigger>
      </DTabsList>

      <DTabsContent value="FULL" className="mt-2">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-brand)]/[.045] px-3 py-2.5">
          <span className="text-xs text-[var(--color-text)]">
            {copy('Pay full remaining balance')}
          </span>
          <span className="shrink-0 text-base font-bold tabular-nums text-[var(--color-brand)]">
            {format(remainingAmount)}
          </span>
        </div>
      </DTabsContent>

      <DTabsContent value="SPLIT" className="mt-2">
        <label className="block text-sm font-medium">
          {copy('Payment amount')}
          <PosCurrencyInput
            aria-label={copy('Payment amount')}
            className="mt-1.5 h-11 rounded-lg bg-[var(--color-surface)] text-right text-lg font-bold"
            value={appliedAmount}
            onChange={onAppliedAmount}
            fractionDigits={amountScale}
          />
        </label>
        {overAllocated ? (
          <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
            {copy('Payment allocation cannot exceed the remaining amount.')} {copy('Remaining')}:{' '}
            {format(remainingAmount)}
          </p>
        ) : (
          <div className="mt-2">
            <PaymentIntentHint intent={intent} format={format} onPayRemaining={onPayRemaining} />
          </div>
        )}
      </DTabsContent>
    </DTabs>
  );
}
