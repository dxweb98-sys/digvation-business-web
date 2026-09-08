import { DBadge, DButton, DConnectionError, DDataTable, DDatePicker, DDialog, DSelectFilter, type TableColumn } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useRuntime } from '@digvation/pos-runtime';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { TransactionHistoryApi, type FulfillmentStatus, type PaymentStatus, type Sale, type SaleStatus } from './transaction-history-api';

const defaultPageSize = 20;

export function TransactionHistoryPage() {
  const { createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatDate, formatMoney } = useBackofficeLocalization();
  const api = useMemo(() => new TransactionHistoryApi(createApiClient(runtime.apiBaseUrl)), [createApiClient, runtime.apiBaseUrl]);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [q, setQ] = useState('');
  const [saleStatus, setSaleStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fulfillmentStatus, setFulfillmentStatus] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const list = useQuery({ queryKey: ['transaction-history', offset, pageSize, q, saleStatus, paymentStatus, fulfillmentStatus, createdFrom, createdTo], queryFn: () => api.list({ limit: pageSize, offset, q, saleStatus, paymentStatus, fulfillmentStatus, createdFrom, createdTo }) });
  const detail = useQuery({ queryKey: ['transaction-history-detail', detailId], queryFn: () => api.get(detailId!), enabled: Boolean(detailId) });
  if (list.isError) return <DConnectionError title={copy('Could not load transaction history.')} message={copy('Try loading transaction history again.')} onRetry={() => void list.refetch()} />;
  const columns: TableColumn<Sale>[] = [
    { key: 'date', label: copy('Date'), render: (row) => formatDate(new Date(row.createdAt), { dateStyle: 'medium', timeStyle: 'short' }) },
    { key: 'sale', label: copy('Transaction number'), render: (row) => <div><p className="font-mono text-xs font-semibold">{row.saleNumber}</p>{row.invoiceNumber ? <p className="mt-1 font-mono text-xs text-[var(--color-text-muted)]">{row.invoiceNumber}</p> : null}</div> },
    { key: 'amount', label: copy('Total'), render: (row) => formatMoney(row.totalAmount, row.currency) },
    { key: 'saleStatus', label: copy('Sale status'), render: (row) => <StatusBadge status={row.status} /> },
    { key: 'payments', label: copy('Payments'), render: (row) => row.payments.length ? <div className="flex flex-wrap gap-1">{row.payments.map((payment) => <StatusBadge key={payment.id} status={payment.status} />)}</div> : '—' },
    { key: 'fulfillment', label: copy('Fulfillment'), render: (row) => <FulfillmentSummary lines={row.lines} /> },
  ];
  const resetPage = () => setOffset(0);
  return <BackofficePage><BackofficePageHeader eyebrow={copy('Reporting')} title={copy('Transaction history')} description={copy('Review sale, payment, and fulfillment facts without changing their lifecycle.')} /><section className="mt-6"><DDataTable columns={columns} data={list.data?.items ?? []} loading={list.isLoading} rowKey="id" searchable searchPlaceholder={copy('Search payment reference or location...')} searchValue={q} onSearchChange={(value) => { setQ(value); resetPage(); }} filters={<div className="flex flex-wrap gap-2"><DSelectFilter label={copy('Sale status')} value={saleStatus || null} clearable onChange={(value) => { setSaleStatus(String(value ?? '')); resetPage(); }} options={saleStatuses.map((value) => ({ value, label: copy(value) }))} /><DSelectFilter label={copy('Payment status')} value={paymentStatus || null} clearable onChange={(value) => { setPaymentStatus(String(value ?? '')); resetPage(); }} options={paymentStatuses.map((value) => ({ value, label: copy(value) }))} /><DSelectFilter label={copy('Fulfillment status')} value={fulfillmentStatus || null} clearable onChange={(value) => { setFulfillmentStatus(String(value ?? '')); resetPage(); }} options={fulfillmentStatuses.map((value) => ({ value, label: copy(value) }))} /><DDatePicker label={copy('From')} value={createdFrom} onChange={(value) => { setCreatedFrom(value); resetPage(); }} /><DDatePicker label={copy('To')} value={createdTo} onChange={(value) => { setCreatedTo(value); resetPage(); }} /></div>} actions={[{ label: copy('View transaction'), icon: <Eye aria-hidden="true" className="size-4" />, onClick: (row) => setDetailId(row.id) }]} pagination={{ page: Math.floor(offset / pageSize) + 1, pageSize, total: list.data?.total ?? 0 }} onPageChange={(page) => setOffset((page - 1) * pageSize)} onPageSizeChange={(size) => { setPageSize(size); resetPage(); }} emptyMessage={copy('No transactions match the current filters.')} /></section><TransactionDetail open={Boolean(detailId)} item={detail.data} loading={detail.isLoading} error={detail.isError} onClose={() => setDetailId(null)} /></BackofficePage>;
}

const saleStatuses: SaleStatus[] = ['OPEN', 'FINALIZED', 'VOIDED'];
const paymentStatuses: PaymentStatus[] = ['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED'];
const fulfillmentStatuses: FulfillmentStatus[] = ['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'];

function StatusBadge({ status }: { status: SaleStatus | PaymentStatus | FulfillmentStatus }) { const { copy } = useBackofficeLocalization(); const variant = ['FINALIZED', 'SUCCEEDED', 'COMPLETED'].includes(status) ? 'success' : ['VOIDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'CANCELED'].includes(status) ? 'secondary' : status === 'PENDING' || status === 'IN_PROGRESS' ? 'warning' : 'outline'; return <DBadge variant={variant}>{copy(status)}</DBadge>; }
function FulfillmentSummary({ lines }: { lines: Sale['lines'] }) { const tracked = lines.filter((line) => line.fulfillment); return tracked.length ? <div className="flex flex-wrap gap-1">{tracked.map((line) => <StatusBadge key={line.id} status={line.fulfillment!.status} />)}</div> : '—'; }
function TransactionDetail({ open, item, loading, error, onClose }: { open: boolean; item: Sale | undefined; loading: boolean; error: boolean; onClose: () => void }) { const { copy, formatDate, formatMoney } = useBackofficeLocalization(); return <DDialog open={open} onClose={onClose} title={copy('Transaction details')} footer={<div className="flex justify-end"><DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton></div>}>{loading ? <p className="text-sm text-[var(--color-text-muted)]">{copy('Loading transaction details...')}</p> : error || !item ? <DConnectionError title={copy('Could not load transaction details.')} message={copy('Close this dialog and try again.')} onRetry={onClose} /> : <div className="space-y-6"><section><h3 className="text-sm font-semibold">{copy('Sale information')}</h3><dl className="mt-3 grid gap-3 sm:grid-cols-2"><Fact label={copy('Sale')} value={item.id} mono /><Fact label={copy('Date')} value={formatDate(new Date(item.createdAt), { dateStyle: 'medium', timeStyle: 'short' })} /><Fact label={copy('Total')} value={formatMoney(item.totalAmount, item.currency)} /><Fact label={copy('Sale status')} value={<StatusBadge status={item.status} />} /></dl></section><section><h3 className="text-sm font-semibold">{copy('Payment information')}</h3><div className="mt-3 space-y-2">{item.payments.length ? item.payments.map((payment) => <div key={payment.id} className="rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 text-sm"><div className="flex items-center justify-between gap-3"><span>{copy(payment.method)}</span><StatusBadge status={payment.status} /></div><p className="mt-1 font-semibold">{formatMoney(payment.appliedAmount, payment.currency)}</p>{payment.providerReference ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{payment.providerReference}</p> : null}</div>) : <p className="text-sm text-[var(--color-text-muted)]">{copy('No payment attempts are recorded.')}</p>}</div></section><section><h3 className="text-sm font-semibold">{copy('Fulfillment information')}</h3><div className="mt-3 space-y-2">{item.lines.filter((line) => line.fulfillment).length ? item.lines.filter((line) => line.fulfillment).map((line) => <div key={line.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3 text-sm"><span>{line.itemNameSnapshot}{line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}</span><StatusBadge status={line.fulfillment!.status} /></div>) : <p className="text-sm text-[var(--color-text-muted)]">{copy('No tracked fulfillment is recorded.')}</p>}</div></section></div>}</DDialog>; }
function Fact({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) { return <div><dt className="text-xs font-medium text-[var(--color-text-muted)]">{label}</dt><dd className={`mt-1 text-sm ${mono ? 'break-all font-mono text-xs' : ''}`}>{value}</dd></div>; }
