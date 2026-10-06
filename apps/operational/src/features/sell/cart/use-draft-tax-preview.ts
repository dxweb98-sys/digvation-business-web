import { createDecimal } from '@digvation/pos-money';
import { useQuery } from '@tanstack/react-query';
import { cashierTransactionKeys } from '../transaction/api/cashier-transaction-keys';
import type { createCashierTransactionAdapter } from '../transaction/api/cashier-transaction-adapter-factory';
import type { Sale } from '../transaction/model/cashier-transaction.types';

/**
 * Tax preview of a local cart draft: before a Sale exists the draft tax is estimated from the tax
 * configuration; once the Sale exists its own amounts are shown.
 */
export function useDraftTaxPreview({
  adapter,
  sale,
  workspace,
  total,
  copy,
}: {
  adapter: ReturnType<typeof createCashierTransactionAdapter>;
  sale: Sale | null;
  workspace: { cart: { isLocalDraft: boolean; grossAmount: string; taxAmount: string } };
  total: string;
  copy: (value: string) => string;
}) {
  const taxConfigurationQuery = useQuery({
    queryKey: cashierTransactionKeys.taxConfiguration(),
    queryFn: ({ signal }) => adapter.getTaxConfiguration(signal),
    staleTime: 60_000,
  });
  const draftTaxAmount =
    !sale && workspace.cart.isLocalDraft && taxConfigurationQuery.data?.enabled
      ? createDecimal(workspace.cart.grossAmount)
          .times(createDecimal(taxConfigurationQuery.data.rate))
          .toFixed(4)
      : workspace.cart.taxAmount;
  const cartPreviewTotal =
    !sale && workspace.cart.isLocalDraft
      ? createDecimal(workspace.cart.grossAmount).plus(createDecimal(draftTaxAmount)).toFixed(4)
      : total;
  const isTaxPreviewLoading =
    !sale && workspace.cart.isLocalDraft && taxConfigurationQuery.isLoading;
  const isTaxPreviewUnavailable =
    !sale && workspace.cart.isLocalDraft && taxConfigurationQuery.isError;
  const draftTaxLabel = taxConfigurationQuery.data?.enabled
    ? `${copy('Tax')} (${createDecimal(taxConfigurationQuery.data.rate)
        .times(100)
        .toFixed(2)
        .replace(/\.?0+$/, '')}%)`
    : copy('Tax');
  return {
    draftTaxAmount,
    cartPreviewTotal,
    isTaxPreviewLoading,
    isTaxPreviewUnavailable,
    draftTaxLabel,
  };
}
