import { useRuntime } from '@digvation/pos-runtime';
import { useQuery } from '@tanstack/react-query';
import { CircleDollarSign, ReceiptText, WalletCards } from 'lucide-react';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';

type Projection = { summary: Record<string, string | number | null> };
type OperationalAccess = {
  resolution: 'DENIED' | 'AUTO_RESOLVED' | 'SELECTION_REQUIRED';
  selectedLocationId: string | null;
};

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ReceiptText;
}) {
  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </section>
  );
}

export function DashboardPage() {
  const { t, formatMoney } = useBackofficeLocalization();
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const api = createApiClient(apiBaseUrl);
  const hasPos = Boolean(
    session?.effectiveEntitlements.products.includes('POS') &&
    session.identity.permissions.includes('sales:read'),
  );
  const hasFinance = Boolean(
    session?.effectiveEntitlements.capabilities.includes('FINANCE_OPERATIONS') &&
    session.identity.permissions.some((permission) =>
      ['expenses:read', 'cash:read', 'settlements:read', 'reconciliations:read'].includes(
        permission,
      ),
    ),
  );
  const access = useQuery({
    queryKey: ['dashboard-location-context'],
    queryFn: () => api.get<OperationalAccess>('/api/v1/operational-access/context'),
  });
  const locationId =
    access.data?.resolution === 'AUTO_RESOLVED' ? access.data.selectedLocationId : null;
  const params = new URLSearchParams({
    dateFrom: new Date().toISOString().slice(0, 10),
    dateTo: new Date().toISOString().slice(0, 10),
    ...(locationId ? { sellingLocationId: locationId } : {}),
  }).toString();
  const sales = useQuery({
    queryKey: ['dashboard-pos', params],
    enabled: hasPos && access.data?.resolution !== 'SELECTION_REQUIRED',
    queryFn: () => api.get<Projection>(`/api/v1/reports/business-performance?${params}`),
  });
  const cash = useQuery({
    queryKey: ['dashboard-finance', params],
    enabled: hasFinance && access.data?.resolution !== 'SELECTION_REQUIRED',
    queryFn: () => api.get<Projection>(`/api/v1/reports/cash?${params}`),
  });
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={t('overview')}
        title={t('dashboard')}
        description="Ringkasan menyusun proyeksi domain yang tersedia untuk akses Anda."
      />
      {access.data?.resolution === 'SELECTION_REQUIRED' ? (
        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-5 text-sm">
          Pilih konteks lokasi pada Laporan untuk melihat proyeksi yang dibatasi lokasi.
        </section>
      ) : null}
      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {hasPos ? (
          <Metric
            label="Penjualan hari ini"
            value={formatMoney(String(sales.data?.summary.finalRevenue ?? 0), 'IDR')}
            icon={ReceiptText}
          />
        ) : null}
        {hasPos ? (
          <Metric
            label="Transaksi hari ini"
            value={String(sales.data?.summary.transactionCount ?? 0)}
            icon={CircleDollarSign}
          />
        ) : null}
        {hasFinance ? (
          <Metric
            label="Pergerakan kas bersih"
            value={formatMoney(String(cash.data?.summary.netMovement ?? 0), 'IDR')}
            icon={WalletCards}
          />
        ) : null}
      </section>
      {!hasPos && !hasFinance ? (
        <section className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-muted)]">
          Tidak ada proyeksi domain yang tersedia untuk entitlements, izin, dan konteks lokasi Anda.
        </section>
      ) : null}
    </BackofficePage>
  );
}
