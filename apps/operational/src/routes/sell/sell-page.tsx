import { useMemo } from 'react';

import { useOperationalSession } from '../../modules/operational/operational-session-provider';
import { SaleAdjustmentControls } from '../../features/sell/components/sale-adjustment-controls';
import { ReplatformedPosWorkspace } from '../../features/sell/components/replatformed-pos-workspace';
import { VariantPicker } from '../../features/sell/components/variant-picker';
import { createCashierTransactionAdapter } from '../../features/sell/cashier-transaction-adapter-factory';
import { useCashierTransactionWorkspace } from '../../features/sell/use-cashier-transaction-workspace';

export function SellPage() {
  const { runtime, authPort } = useOperationalSession();
  const adapter = useMemo(
    () => createCashierTransactionAdapter(runtime, authPort.getAccessToken?.bind(authPort)),
    [authPort, runtime],
  );
  const workspace = useCashierTransactionWorkspace(adapter);

  return (
    <section className="flex h-[calc(100dvh-64px)] flex-col overflow-hidden bg-[var(--color-bg)]">
      <div className="flex shrink-0 justify-end border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
        <SaleAdjustmentControls workspace={workspace} />
      </div>
      <div className="min-h-0 flex-1">
        <ReplatformedPosWorkspace workspace={workspace} />
      </div>
      <VariantPicker workspace={workspace} />
    </section>
  );
}
