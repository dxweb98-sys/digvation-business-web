import { useQuery } from '@tanstack/react-query';

import { referenceQueryPolicy } from '../../../../app/data/operational-cache-policy';
import type { PaymentRouteQuery } from '../../cashier-transaction.adapter';
import { cashierTransactionKeys } from '../../cashier-transaction-keys';

export function usePaymentRoutes(
  client: PaymentRouteQuery,
  sellingLocationId: string | null,
  currency: string,
) {
  const query = useQuery({
    queryKey: cashierTransactionKeys.paymentRoutes(sellingLocationId ?? '', currency),
    queryFn: ({ signal }) =>
      client.listPaymentRoutes(
        { sellingLocationId: sellingLocationId!, currency },
        signal,
      ),
    enabled: Boolean(sellingLocationId && currency),
    ...referenceQueryPolicy,
  });

  const refresh = async () => {
    const result = await query.refetch();
    return (result.data?.items ?? []).filter((route) => route.status === 'ACTIVE');
  };

  return { query, refresh };
}
