import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  SalePricingPreview,
  SalePricingPreviewInput,
} from '../transaction/api/cashier-transaction.adapter';
import { cashierTransactionKeys } from '../transaction/api/cashier-transaction-keys';
import { saleTaxLabel } from '../transaction/model/sale-presentation';

export interface CartPricingPreviewDisplay {
  grossAmount: string;
  discountAmount: string;
  discountRows: Array<{ key: string; label: string; amount: string }>;
  taxAmount: string;
  taxLabel: string;
  totalAmount: string;
}

/**
 * Runtime's read-only pricing of the local draft, shown in the cart before checkout.
 *
 * - Each exact pricing input is its own query, and a superseded request is aborted, so a late
 *   answer for an older cart can never be shown for the current one.
 * - While the next answer is on its way the last answer for this draft stays on screen: the
 *   summary never blanks or drops to Rp 0.
 * - A failed preview shows nothing from Runtime (the caller keeps its plain estimate) and never
 *   blocks checkout, which prices the created Sale itself.
 */
export function useCartPricingPreview({
  adapter,
  input,
  copy,
}: {
  adapter: {
    previewSalePricing(
      input: SalePricingPreviewInput,
      signal?: AbortSignal,
    ): Promise<SalePricingPreview>;
  };
  input: SalePricingPreviewInput | null;
  copy: (value: string) => string;
}): CartPricingPreviewDisplay | null {
  const query = useQuery({
    queryKey: cashierTransactionKeys.pricingPreview(input),
    queryFn: ({ signal }) => adapter.previewSalePricing(input!, signal),
    enabled: input !== null,
    staleTime: 30_000,
    retry: false,
  });
  const [shown, setShown] = useState<SalePricingPreview | null>(null);
  const current = input === null || query.isError ? null : (query.data ?? shown);
  if (current !== shown) setShown(current);
  if (!current) return null;
  return {
    grossAmount: current.grossAmount,
    discountAmount: current.discountAmount,
    discountRows: current.promotions.map((promotion) => ({
      key: promotion.promotionId,
      label: promotion.label,
      amount: promotion.amount,
    })),
    taxAmount: current.taxAmount,
    taxLabel: saleTaxLabel(
      {
        transactionTaxAmount: current.taxAmount,
        transactionTaxRate: current.taxRate,
        transactionTaxTreatment: current.taxPriceTreatment,
        lines: [],
      },
      copy('Tax'),
    ),
    totalAmount: current.totalAmount,
  };
}
