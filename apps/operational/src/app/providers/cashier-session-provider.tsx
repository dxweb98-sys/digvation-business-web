import { useOperationalSession } from '../../modules/operational/operational-session-provider';
import { usePosOperationalSession } from '../../modules/pos/pos-operational-session-provider';

/**
 * Compatibility bridge for the accepted cashier transaction flow while the app
 * boundary is now Operational. New shell/runtime code should use the split
 * operational + POS session providers directly.
 */
export function useCashierSession() {
  const operational = useOperationalSession();
  const pos = usePosOperationalSession();

  return {
    selectedLocationId: operational.selectedLocationId,
    recentSaleIds: pos.recentSaleIds,
    isBranchPickerOpen: operational.isBranchPickerOpen,
    selectLocation: operational.selectLocation,
    openBranchPicker: operational.openBranchPicker,
    closeBranchPicker: operational.closeBranchPicker,
    rememberSale: pos.rememberSale,
  };
}
