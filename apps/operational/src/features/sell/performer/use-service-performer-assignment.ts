import { useState } from 'react';
import type { Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import type { ServiceLineWorkPlan } from './service-performer-allocation';
import type { Dispatch, SetStateAction } from 'react';
import type { useToast } from '@digvation-labs/ui';

/** Service performer assignment of a queued Sale: the dialog target and saving its work plan. */
export function useServicePerformerAssignment({
  workspace,
  setQueueDetail,
  showToast,
  copy,
}: {
  workspace: {
    setQueuedWorkUnits: (sale: Sale, plans: readonly ServiceLineWorkPlan[]) => Promise<Sale>;
  };
  setQueueDetail: Dispatch<SetStateAction<Sale | null>>;
  showToast: ReturnType<typeof useToast>['showToast'];
  copy: (value: string) => string;
}) {
  const [performerTarget, setPerformerTarget] = useState<{
    sale: Sale;
    line: SaleLine;
  } | null>(null);
  const [isSavingPerformers, setSavingPerformers] = useState(false);
  const savePerformers = async (
    target: { sale: Sale; line: SaleLine },
    plans: ServiceLineWorkPlan[],
  ) => {
    setSavingPerformers(true);
    try {
      const updated = await workspace.setQueuedWorkUnits(target.sale, plans);
      setQueueDetail(updated);
      setPerformerTarget(null);
      showToast({
        title: copy('Employee updated'),
        description: copy('Service assignment saved for this transaction.'),
        variant: 'success',
      });
    } catch {
      showToast({
        title: copy('Could not update employee'),
        description: copy('Assignment was not changed. Try again.'),
        variant: 'danger',
      });
    } finally {
      setSavingPerformers(false);
    }
  };
  return { performerTarget, setPerformerTarget, isSavingPerformers, savePerformers };
}
