import { useParams } from 'react-router';

import { SaleAdjustmentControls } from '../../features/sell/components/sale-adjustment-controls';
import { ReplatformedPosWorkspace } from '../../features/sell/components/replatformed-pos-workspace';
import { VariantPicker } from '../../features/sell/components/variant-picker';
import { useCashierTransactionWorkspace } from '../../features/sell/use-cashier-transaction-workspace';

export function SellPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const workspace = useCashierTransactionWorkspace(saleId);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 justify-end border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <SaleAdjustmentControls workspace={workspace} />
      </div>
      <div className="min-h-0 flex-1">
        <ReplatformedPosWorkspace workspace={workspace} />
      </div>
      {workspace.variantPicker?.context !== 'TRANSACTION_ADJUSTMENT' && workspace.variantPicker ? (
        <VariantPicker
          {...workspace.variantPicker}
          onSelect={workspace.selectVariant}
          onClose={workspace.closeVariantPicker}
        />
      ) : null}
    </section>
  );
}
