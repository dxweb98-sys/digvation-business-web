import { formatMoney } from '@digvation/pos-money';
import { useRuntime } from '@digvation/pos-runtime';
import { DButton } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock3, LoaderCircle, ReceiptText } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { useCashierSession } from '../../app/providers/cashier-session-provider';
import { cashierTransactionKeys } from '../../features/sell/cashier-transaction-keys';
import { createCashierTransactionAdapter } from '../../features/sell/cashier-transaction-client';
import type { OpenSaleSummaryViewModel } from '../../features/sell/cashier-transaction.types';

export function OpenSalesPage() {
  const runtime = useRuntime();
  const navigate = useNavigate();
  const { selectedLocationId, recentSaleIds, selectLocation, rememberSale } = useCashierSession();
  const transactionAdapter = useMemo(
    () => createCashierTransactionAdapter(runtime.apiBaseUrl),
    [runtime.apiBaseUrl],
  );

  const locationsQuery = useQuery({
    queryKey: cashierTransactionKeys.locations(),
    queryFn: ({ signal }) => transactionAdapter.listSellingLocations(signal),
  });
  const salesQuery = useQuery({
    queryKey: cashierTransactionKeys.sales(),
    queryFn: ({ signal }) => transactionAdapter.listSales(signal),
  });

  const locationNames = new Map(
    (locationsQuery.data?.items ?? []).map((location) => [location.id, location.name]),
  );
  const openSales = (salesQuery.data?.items ?? [])
    .filter((sale) => sale.status === 'OPEN')
    .filter((sale) => !selectedLocationId || sale.sellingLocationId === selectedLocationId)
    .map<OpenSaleSummaryViewModel>((sale) => ({
      id: sale.id,
      sellingLocationId: sale.sellingLocationId,
      locationName: locationNames.get(sale.sellingLocationId) ?? 'Branch',
      totalAmount: sale.totalAmount,
      currency: sale.currency,
      activeLineCount: sale.lines.filter((line) => line.removedAt === null).length,
      updatedAt: sale.updatedAt,
    }))
    .sort((left, right) => {
      const leftRecent = recentSaleIds.indexOf(left.id);
      const rightRecent = recentSaleIds.indexOf(right.id);
      if (leftRecent >= 0 || rightRecent >= 0) {
        if (leftRecent < 0) return 1;
        if (rightRecent < 0) return -1;
        return leftRecent - rightRecent;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });

  const resumeSale = (sale: OpenSaleSummaryViewModel) => {
    selectLocation(sale.sellingLocationId);
    rememberSale(sale.id);
    navigate(`/sell/${sale.id}`);
  };

  return (
    <section className="h-full min-h-0 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
      <div className="mx-auto max-w-[1800px]">
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-panel)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-[-0.03em]">Open Sales</h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Continue a transaction from todayÃ¢â‚¬â„¢s active workspace.
            </p>
          </div>
          <div className="flex gap-2">
            <DButton variant="secondary" onClick={() => navigate('/sell')}>
              <ArrowLeft className="mr-2 size-4" /> Sell
            </DButton>
          </div>
        </div>

        <div className="mt-4">
          {salesQuery.isLoading ? (
            <div className="flex min-h-52 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
              <LoaderCircle className="mr-2 size-4 animate-spin" /> Loading open SalesÃ¢â‚¬Â¦
            </div>
          ) : openSales.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center">
              <ReceiptText className="mx-auto size-6 text-[var(--color-text-muted)]" />
              <p className="mt-4 text-sm font-bold">No OPEN Sales in this Branch view</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Start a new one from Sell when you are ready.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {openSales.map((sale) => (
                <DButton
                  variant="ghost"
                  key={sale.id}
                  type="button"
                  onClick={() => resumeSale(sale)}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-[var(--shadow-panel)] transition-[transform,box-shadow,border-color] duration-150 hover:border-[var(--color-brand)]/35 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-brand)]">
                        {sale.locationName} Ã‚Â· Open
                      </p>
                      <h2 className="mt-2 text-base font-bold">Sale {sale.id.slice(0, 8)}</h2>
                    </div>
                    <p className="text-sm font-bold tabular-nums">
                      {formatMoney(sale.totalAmount, sale.currency, runtime.locale)}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>{sale.activeLineCount} active lines</span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="size-3.5" /> Updated{' '}
                      {new Intl.DateTimeFormat(runtime.locale, {
                        hour: '2-digit',
                        minute: '2-digit',
                      }).format(new Date(sale.updatedAt))}
                    </span>
                  </div>
                </DButton>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
