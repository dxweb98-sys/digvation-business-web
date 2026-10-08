import { useParams } from 'react-router';

import { ReplatformedPosWorkspace } from '../../features/sell/workspace/ui/replatformed-pos-workspace';
import { ItemConfigurator } from '../../features/sell/cart/item-configurator';
import { useCashierTransactionWorkspace } from '../../features/sell/workspace/model/use-cashier-transaction-workspace';

export function SellPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const workspace = useCashierTransactionWorkspace(saleId);

  return (
    <section className="h-full min-h-0 overflow-hidden">
      <ReplatformedPosWorkspace workspace={workspace} />
      {workspace.itemConfigurator ? (
        <ItemConfigurator
          {...workspace.itemConfigurator}
          loadCandidates={workspace.loadComponentCandidates}
          onConfirm={workspace.confirmItemConfiguration}
          onClose={workspace.closeItemConfigurator}
        />
      ) : null}
    </section>
  );
}
