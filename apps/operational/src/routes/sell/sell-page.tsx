import { useParams } from 'react-router';

import { ReplatformedPosWorkspace } from '../../features/sell/components/replatformed-pos-workspace';
import { VariantPicker } from '../../features/sell/components/variant-picker';
import { useCashierTransactionWorkspace } from '../../features/sell/use-cashier-transaction-workspace';

export function SellPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const workspace = useCashierTransactionWorkspace(saleId);

  return (
    <section className="h-full min-h-0 overflow-hidden">
      <ReplatformedPosWorkspace workspace={workspace} />
      {workspace.variantPicker ? (
        <VariantPicker
          {...workspace.variantPicker}
          onSelect={workspace.selectVariant}
          onClose={workspace.closeVariantPicker}
        />
      ) : null}
    </section>
  );
}
