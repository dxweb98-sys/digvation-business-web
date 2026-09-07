import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DButton,
  DBadge,
  DConnectionError,
  DDataTable,
  DDialog,
  DInput,
  DSelect,
  DTabs,
  DTabsContent,
  DTabsList,
  DTabsTrigger,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { CircleCheck, Eye, Plus } from 'lucide-react';
import { useRuntime } from '@digvation/pos-runtime';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import type { PaymentMethod } from '../financial-accounts/financial-accounts-api';
import {
  FinancialOperationsApi,
  type CashMovement,
  type Reconciliation,
  type Settlement,
} from './financial-operations-api';

const defaultPageSize = 25;
const methods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'WALLET', 'QRIS'];
const label = (method: PaymentMethod) =>
  method === 'BANK_TRANSFER'
    ? 'Bank transfer'
    : method === 'WALLET'
      ? 'E-wallet'
      : method === 'CASH'
        ? 'Cash'
        : 'QRIS';
const format = (amount: string, currency: string) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );

export function FinancialOperationsPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const api = useMemo(
    () => new FinancialOperationsApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  const { copy } = useBackofficeLocalization();
  if (!session) return null;
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Finance')}
        title={copy('Cash, settlements & reconciliation')}
        description={copy(
          'Review cash position, settle accepted payments, and record reconciliation outcomes.',
        )}
      />
      <DTabs defaultValue="cash" className="mt-6">
        <DTabsList>
          <DTabsTrigger value="cash">{copy('Cash position')}</DTabsTrigger>
          <DTabsTrigger value="settlements">{copy('Settlements')}</DTabsTrigger>
          <DTabsTrigger value="reconciliation">{copy('Reconciliation')}</DTabsTrigger>
        </DTabsList>
        <DTabsContent value="cash">
          <CashPanel api={api} />
        </DTabsContent>
        <DTabsContent value="settlements">
          <SettlementPanel api={api} />
        </DTabsContent>
        <DTabsContent value="reconciliation">
          <ReconciliationPanel api={api} />
        </DTabsContent>
      </DTabs>
    </BackofficePage>
  );
}
function CashPanel({ api }: { api: FinancialOperationsApi }) {
  const { session } = useBackofficeAuth();
  const { copy } = useBackofficeLocalization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [positionOffset, setPositionOffset] = useState(0);
  const [positionPageSize, setPositionPageSize] = useState(defaultPageSize);
  const [movementOffset, setMovementOffset] = useState(0);
  const [movementPageSize, setMovementPageSize] = useState(defaultPageSize);
  const positions = useQuery({ queryKey: ['cash-position'], queryFn: () => api.positions() });
  const movements = useQuery({
    queryKey: ['cash-movements', movementOffset, movementPageSize],
    queryFn: () => api.movements({ limit: movementPageSize, offset: movementOffset }),
  });
  const columns: TableColumn<NonNullable<typeof positions.data>[number]>[] = [
    {
      key: 'location',
      label: copy('Selling location'),
      render: (row) => `${row.sellingLocationName} · ${row.sellingLocationCode}`,
    },
    {
      key: 'account',
      label: copy('Cash account'),
      render: (row) => `${row.financialAccountName} · ${row.financialAccountCode}`,
    },
    {
      key: 'payments',
      label: copy('Accepted cash'),
      render: (row) => format(row.paymentAmount, row.currency),
    },
    {
      key: 'movements',
      label: copy('Cash movements'),
      render: (row) => format(row.movementAmount, row.currency),
    },
    {
      key: 'position',
      label: copy('Cash position'),
      render: (row) => format(row.positionAmount, row.currency),
    },
  ];
  if (positions.isError || movements.isError)
    return (
      <DConnectionError
        title={copy('Could not load cash operations.')}
        message={copy('Try loading cash operations again.')}
        onRetry={() => {
          void positions.refetch();
          void movements.refetch();
        }}
      />
    );
  return (
    <section className="mt-5 space-y-6">
      <DDataTable
        columns={columns}
        data={(positions.data ?? []).slice(positionOffset, positionOffset + positionPageSize)}
        loading={positions.isLoading}
        rowKey={(row) => `${row.sellingLocationId}-${row.financialAccountId}`}
        emptyMessage={copy('No cash positions are available.')}
        headerActions={
          canPerformBackofficeAction(session!, 'moveCash') ? (
            <DButton leftIcon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setOpen(true)}>
              {copy('Record cash movement')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(positionOffset / positionPageSize) + 1,
          pageSize: positionPageSize,
          total: positions.data?.length ?? 0,
        }}
        onPageChange={(page) => setPositionOffset((page - 1) * positionPageSize)}
        onPageSizeChange={(pageSize) => {
          setPositionPageSize(pageSize);
          setPositionOffset(0);
        }}
      />
      <div>
        <h2 className="mb-3 text-base font-bold">{copy('Cash movements')}</h2>
        <DDataTable
          columns={[
            { key: 'type', label: copy('Movement type') },
            {
              key: 'amount',
              label: copy('Amount'),
              render: (row) => format(row.amount, row.currency),
            },
            { key: 'note', label: copy('Note'), render: (row) => row.note ?? '—' },
          ]}
          data={movements.data?.items ?? []}
          loading={movements.isLoading}
          rowKey="id"
          emptyMessage={copy('No cash movements are recorded.')}
          pagination={{
            page: Math.floor(movementOffset / movementPageSize) + 1,
            pageSize: movementPageSize,
            total: movements.data?.total ?? 0,
          }}
          onPageChange={(page) => setMovementOffset((page - 1) * movementPageSize)}
          onPageSizeChange={(pageSize) => {
            setMovementPageSize(pageSize);
            setMovementOffset(0);
          }}
        />
      </div>
      <MovementDialog
        open={open}
        onClose={() => setOpen(false)}
        api={api}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['cash-position'] })}
      />
    </section>
  );
}
function SettlementPanel({ api }: { api: FinancialOperationsApi }) {
  const { session } = useBackofficeAuth();
  const { copy } = useBackofficeLocalization();
  const qc = useQueryClient();
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const query = useQuery({
    queryKey: ['settlements', offset, pageSize],
    queryFn: () => api.settlements({ limit: pageSize, offset }),
  });
  if (query.isError)
    return (
      <DConnectionError
        title={copy('Could not load settlements.')}
        message={copy('Try loading settlements again.')}
        onRetry={() => void query.refetch()}
      />
    );
  const columns: TableColumn<Settlement>[] = [
    { key: 'location', label: copy('Selling location'), render: (row) => row.sellingLocationName },
    {
      key: 'method',
      label: copy('Payment method'),
      render: (row) => copy(label(row.paymentMethod)),
    },
    {
      key: 'destination',
      label: copy('Settlement destination'),
      render: (row) => row.financialAccountName,
    },
    {
      key: 'amount',
      label: copy('Expected amount'),
      render: (row) => format(row.expectedAmount, row.currency),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (row) => <SettlementBadge status={row.status} />,
    },
  ];
  return (
    <section className="mt-5">
      <DDataTable
        columns={columns}
        data={query.data?.items ?? []}
        loading={query.isLoading}
        rowKey="id"
        emptyMessage={copy('No settlements are available.')}
        headerActions={
          canPerformBackofficeAction(session!, 'createSettlement') ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setCreate(true)}>
              {copy('Create settlement')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total: query.data?.total ?? 0,
        }}
        onPageChange={(page) => setOffset((page - 1) * pageSize)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setOffset(0);
        }}
        actions={[
          {
            label: copy('View details'),
            icon: <Eye aria-hidden="true" className="size-4" />,
            onClick: setDetail,
          },
        ]}
      />
      <SettlementDialog
        open={create}
        onClose={() => setCreate(false)}
        api={api}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['settlements'] })}
      />
      <SettlementDetail
        item={detail}
        onClose={() => setDetail(null)}
        api={api}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['settlements'] })}
      />
    </section>
  );
}
function ReconciliationPanel({ api }: { api: FinancialOperationsApi }) {
  const { session } = useBackofficeAuth();
  const { copy } = useBackofficeLocalization();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const query = useQuery({
    queryKey: ['reconciliations', offset, pageSize],
    queryFn: () => api.reconciliations({ limit: pageSize, offset }),
  });
  const settlements = useQuery({
    queryKey: ['completed-settlements'],
    queryFn: () => api.settlements({ status: 'COMPLETED', limit: 100, offset: 0 }),
    enabled: open,
  });
  if (query.isError)
    return (
      <DConnectionError
        title={copy('Could not load reconciliation.')}
        message={copy('Try loading reconciliation again.')}
        onRetry={() => void query.refetch()}
      />
    );
  const columns: TableColumn<Reconciliation>[] = [
    {
      key: 'location',
      label: copy('Selling location'),
      render: (row) => row.settlement.sellingLocationName,
    },
    {
      key: 'expected',
      label: copy('Expected amount'),
      render: (row) => format(row.expectedAmount, row.settlement.currency),
    },
    {
      key: 'actual',
      label: copy('Actual amount'),
      render: (row) => format(row.actualAmount, row.settlement.currency),
    },
    {
      key: 'difference',
      label: copy('Difference'),
      render: (row) => format(row.differenceAmount, row.settlement.currency),
    },
    {
      key: 'status',
      label: copy('Status'),
      render: (row) => <ReconciliationBadge status={row.status} />,
    },
  ];
  const resolve = async (item: Reconciliation) => {
    try {
      await api.updateReconciliation(item, 'RESOLVED');
      void qc.invalidateQueries({ queryKey: ['reconciliations'] });
    } catch {
      return;
    }
  };
  return (
    <section className="mt-5">
      <DDataTable
        columns={columns}
        data={query.data?.items ?? []}
        loading={query.isLoading}
        rowKey="id"
        emptyMessage={copy('No reconciliations are available.')}
        headerActions={
          canPerformBackofficeAction(session!, 'createReconciliation') ? (
            <DButton leftIcon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
              {copy('Record reconciliation')}
            </DButton>
          ) : null
        }
        pagination={{
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          total: query.data?.total ?? 0,
        }}
        onPageChange={(page) => setOffset((page - 1) * pageSize)}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setOffset(0);
        }}
        actions={
          canPerformBackofficeAction(session!, 'updateReconciliation')
            ? [
                {
                  label: copy('Resolve discrepancy'),
                  icon: <CircleCheck aria-hidden="true" className="size-4" />,
                  onClick: (item) => {
                    if (item.status === 'DISCREPANCY') void resolve(item);
                  },
                },
              ]
            : []
        }
      />
      <ReconciliationDialog
        open={open}
        onClose={() => setOpen(false)}
        api={api}
        settlements={settlements.data?.items ?? []}
        onSaved={() => void qc.invalidateQueries({ queryKey: ['reconciliations'] })}
      />
    </section>
  );
}
function MovementDialog({
  open,
  onClose,
  api,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  api: FinancialOperationsApi;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [locationId, setLocationId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState<CashMovement['type']>('CASH_IN');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const locations = useQuery({
    queryKey: ['operation-locations'],
    queryFn: () => api.locations(),
    enabled: open,
  });
  const accounts = useQuery({
    queryKey: ['operation-accounts'],
    queryFn: () => api.accounts(),
    enabled: open,
  });
  const save = async () => {
    try {
      await api.createMovement({
        sellingLocationId: locationId,
        financialAccountId: accountId,
        type,
        amount,
        note,
      });
      showToast({ variant: 'success', title: copy('Cash movement recorded.') });
      onSaved();
      onClose();
    } catch (e) {
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(e, copy('Could not record cash movement.')).safeMessage,
      });
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Record cash movement')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!locationId || !accountId || !amount} onClick={() => void save()}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={copy('Selling location')}
          value={locationId}
          options={(locations.data?.items ?? [])
            .filter((x) => x.status === 'ACTIVE')
            .map((x) => ({ value: x.id, label: x.name }))}
          onChange={(v) => setLocationId(String(v))}
        />
        <DSelect
          label={copy('Cash account')}
          value={accountId}
          options={(accounts.data?.items ?? [])
            .filter((x) => x.type === 'CASH')
            .map((x) => ({ value: x.id, label: x.name }))}
          onChange={(v) => setAccountId(String(v))}
        />
        <DSelect
          label={copy('Movement type')}
          value={type}
          options={[
            { value: 'CASH_IN', label: copy('Cash in') },
            { value: 'CASH_OUT', label: copy('Cash out') },
          ]}
          onChange={(v) => setType(v as CashMovement['type'])}
        />
        <DInput label={copy('Amount')} value={amount} onChange={setAmount} />
        <DInput
          label={copy('Note')}
          value={note}
          onChange={setNote}
          containerClassName="sm:col-span-2"
        />
      </div>
    </DDialog>
  );
}
function SettlementDialog({
  open,
  onClose,
  api,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  api: FinancialOperationsApi;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [locationId, setLocationId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const locations = useQuery({
    queryKey: ['operation-locations'],
    queryFn: () => api.locations(),
    enabled: open,
  });
  const accounts = useQuery({
    queryKey: ['operation-accounts'],
    queryFn: () => api.accounts(),
    enabled: open,
  });
  const save = async () => {
    try {
      await api.createSettlement({
        sellingLocationId: locationId,
        financialAccountId: accountId,
        paymentMethod,
      });
      showToast({ variant: 'success', title: copy('Settlement created.') });
      onSaved();
      onClose();
    } catch (e) {
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(e, copy('Could not create settlement.')).safeMessage,
      });
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Create settlement')}
      description={copy(
        'Creates a draft from all unallocated successful payments for the selected routing destination.',
      )}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!locationId || !accountId} onClick={() => void save()}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={copy('Selling location')}
          value={locationId}
          options={(locations.data?.items ?? [])
            .filter((x) => x.status === 'ACTIVE')
            .map((x) => ({ value: x.id, label: x.name }))}
          onChange={(v) => setLocationId(String(v))}
        />
        <DSelect
          label={copy('Payment method')}
          value={paymentMethod}
          options={methods.map((value) => ({ value, label: copy(label(value)) }))}
          onChange={(v) => setPaymentMethod(v as PaymentMethod)}
        />
        <DSelect
          label={copy('Settlement destination')}
          value={accountId}
          options={(accounts.data?.items ?? []).map((x) => ({ value: x.id, label: x.name }))}
          onChange={(v) => setAccountId(String(v))}
        />
      </div>
    </DDialog>
  );
}
function SettlementDetail({
  item,
  onClose,
  api,
  onSaved,
}: {
  item: Settlement | null;
  onClose: () => void;
  api: FinancialOperationsApi;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const transition = async (status: 'COMPLETED' | 'CANCELLED') => {
    if (!item) return;
    try {
      await api.updateSettlement(item, status);
      showToast({ variant: 'success', title: copy('Settlement updated.') });
      onSaved();
      onClose();
    } catch (e) {
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(e, copy('Could not update settlement.')).safeMessage,
      });
    }
  };
  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      title={copy('Settlement details')}
      footer={
        <div className="flex gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Close')}
          </DButton>
          {item?.status === 'DRAFT' ? (
            <>
              <DButton variant="secondary" onClick={() => void transition('CANCELLED')}>
                {copy('Cancel')}
              </DButton>
              <DButton onClick={() => void transition('COMPLETED')}>
                {copy('Complete settlement')}
              </DButton>
            </>
          ) : null}
        </div>
      }
    >
      {item ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-[var(--color-text-muted)]">
              {copy('Expected amount')}
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              {format(item.expectedAmount, item.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--color-text-muted)]">{copy('Status')}</dt>
            <dd className="mt-1">
              <SettlementBadge status={item.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--color-text-muted)]">
              {copy('Settlement destination')}
            </dt>
            <dd className="mt-1 text-sm">{item.financialAccountName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--color-text-muted)]">
              {copy('Payments')}
            </dt>
            <dd className="mt-1 text-sm">{item.payments.length}</dd>
          </div>
        </dl>
      ) : null}
    </DDialog>
  );
}
function ReconciliationDialog({
  open,
  onClose,
  api,
  settlements,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  api: FinancialOperationsApi;
  settlements: Settlement[];
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const [settlementId, setSettlementId] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [note, setNote] = useState('');
  const save = async () => {
    try {
      await api.createReconciliation({ settlementId, actualAmount, note });
      showToast({ variant: 'success', title: copy('Reconciliation recorded.') });
      onSaved();
      onClose();
    } catch (e) {
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(e, copy('Could not record reconciliation.')).safeMessage,
      });
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy('Record reconciliation')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!settlementId || !actualAmount} onClick={() => void save()}>
            {copy('Save')}
          </DButton>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <DSelect
          label={copy('Settlement')}
          value={settlementId}
          options={settlements.map((x) => ({
            value: x.id,
            label: `${x.sellingLocationName} · ${format(x.expectedAmount, x.currency)}`,
          }))}
          onChange={(v) => setSettlementId(String(v))}
        />
        <DInput label={copy('Actual amount')} value={actualAmount} onChange={setActualAmount} />
        <DInput
          label={copy('Note')}
          value={note}
          onChange={setNote}
          containerClassName="sm:col-span-2"
        />
      </div>
    </DDialog>
  );
}
function SettlementBadge({ status }: { status: Settlement['status'] }) {
  const { copy } = useBackofficeLocalization();
  return (
    <DBadge
      variant={
        status === 'COMPLETED' ? 'success' : status === 'CANCELLED' ? 'secondary' : 'outline'
      }
    >
      {copy(status === 'COMPLETED' ? 'Completed' : status === 'CANCELLED' ? 'Cancelled' : 'Draft')}
    </DBadge>
  );
}

function ReconciliationBadge({ status }: { status: Reconciliation['status'] }) {
  const { copy } = useBackofficeLocalization();
  return (
    <DBadge
      variant={status === 'MATCHED' ? 'success' : status === 'RESOLVED' ? 'secondary' : 'warning'}
    >
      {copy(status === 'MATCHED' ? 'Matched' : status === 'RESOLVED' ? 'Resolved' : 'Discrepancy')}
    </DBadge>
  );
}
