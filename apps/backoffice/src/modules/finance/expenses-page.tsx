import {
  DBadge,
  DButton,
  DCurrencyInput,
  DDataTable,
  DDatePicker,
  DDialog,
  DSelect,
  DSelectFilter,
  DTextarea,
  useToast,
  type TableColumn,
} from '@digvation/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Eye, Pencil, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRuntime } from '@digvation/business-runtime';
import { canPerformBackofficeAction } from '../../auth/backoffice-access';
import { useBackofficeAuth } from '../../auth/backoffice-auth-context';
import { normalizeBackofficeApiError } from '../../app/api/backoffice-api-error';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';
import { FinancialOperationsApi } from './financial-operations-api';
import { ExpenseApi, type Expense } from './expense-api';
const limit = 20;
export function ExpensesPage() {
  const { session, createApiClient } = useBackofficeAuth();
  const runtime = useRuntime();
  const { copy, formatDate, formatMoney } = useBackofficeLocalization();
  const api = useMemo(
    () => new ExpenseApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const ops = useMemo(
    () => new FinancialOperationsApi(createApiClient(runtime.apiBaseUrl)),
    [createApiClient, runtime.apiBaseUrl],
  );
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [size, setSize] = useState(limit);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Expense | null | undefined>();
  const [detail, setDetail] = useState<Expense | null>(null);
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const list = useQuery({
    queryKey: ['expenses', offset, size, q, status],
    queryFn: () => api.list({ q, status, limit: size, offset }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['expenses'] });
  const columns: TableColumn<Expense>[] = [
    {
      key: 'date',
      label: copy('Date'),
      render: (x) => formatDate(new Date(x.occurredAt), { dateStyle: 'medium' }),
    },
    { key: 'location', label: copy('Selling location'), render: (x) => x.sellingLocationName },
    { key: 'account', label: copy('Source account'), render: (x) => x.financialAccountName },
    { key: 'category', label: copy('Category'), render: (x) => x.categoryCode },
    { key: 'description', label: copy('Description'), render: (x) => x.note || '—' },
    { key: 'amount', label: copy('Amount'), render: (x) => formatMoney(x.amount, x.currency) },
    { key: 'status', label: copy('Status'), render: (x) => <Badge status={x.status} /> },
  ];
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Finance')}
        title={copy('Expenses')}
        description={copy('Record, review, and approve Finance expenses.')}
      />
      <section className="mt-6">
        <DDataTable
          columns={columns}
          data={list.data?.items ?? []}
          loading={list.isLoading}
          rowKey="id"
          searchable
          searchPlaceholder={copy('Search description, account, or location...')}
          searchValue={q}
          onSearchChange={(v) => {
            setQ(v);
            setOffset(0);
          }}
          filters={
            <DSelectFilter
              label={copy('Status')}
              value={status || null}
              clearable
              onChange={(v) => {
                setStatus(String(v ?? ''));
                setOffset(0);
              }}
              options={[
                { label: copy('Pending'), value: 'PENDING' },
                { label: copy('Approved'), value: 'APPROVED' },
                { label: copy('Rejected'), value: 'REJECTED' },
              ]}
            />
          }
          headerActions={
            session && canPerformBackofficeAction(session, 'createExpense') ? (
              <DButton
                leftIcon={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setEditing(null)}
              >
                {copy('Record expense')}
              </DButton>
            ) : null
          }
          actions={[
            {
              label: copy('View expense'),
              icon: <Eye aria-hidden="true" className="size-4" />,
              onClick: setDetail,
            },
            {
              label: copy('Edit expense'),
              icon: <Pencil aria-hidden="true" className="size-4" />,
              onClick: setEditing,
              show: (x) =>
                x.status === 'PENDING' &&
                Boolean(session && canPerformBackofficeAction(session, 'updateExpense')),
            },
            {
              label: copy('Approve expense'),
              icon: <Check aria-hidden="true" className="size-4" />,
              onClick: (x) => void api.approve(x).then(refresh),
              show: (x) =>
                x.status === 'PENDING' &&
                Boolean(session && canPerformBackofficeAction(session, 'approveExpense')),
            },
            {
              label: copy('Reject expense'),
              icon: <X aria-hidden="true" className="size-4" />,
              variant: 'danger',
              onClick: setRejecting,
              show: (x) =>
                x.status === 'PENDING' &&
                Boolean(session && canPerformBackofficeAction(session, 'rejectExpense')),
            },
          ]}
          pagination={{
            page: Math.floor(offset / size) + 1,
            pageSize: size,
            total: list.data?.total ?? 0,
          }}
          onPageChange={(p) => setOffset((p - 1) * size)}
          onPageSizeChange={(s) => {
            setSize(s);
            setOffset(0);
          }}
          emptyMessage={copy('No expenses are recorded.')}
        />
      </section>
      <ExpenseDialog
        item={editing}
        api={api}
        ops={ops}
        onClose={() => setEditing(undefined)}
        onSaved={refresh}
      />
      <ExpenseDetail item={detail} onClose={() => setDetail(null)} />
      <DDialog
        open={Boolean(rejecting)}
        onClose={() => { setRejecting(null); setRejectionNote(''); }}
        title={copy('Reject expense?')}
        description={copy('This expense will not be realized. A rejection note is required.')}
        footer={<div className="flex justify-end gap-2"><DButton variant="secondary" onClick={() => { setRejecting(null); setRejectionNote(''); }}>{copy('Cancel')}</DButton><DButton variant="danger" disabled={!rejectionNote.trim()} onClick={() => { if (rejecting) void api.reject(rejecting, rejectionNote).then(refresh); setRejecting(null); setRejectionNote(''); }}>{copy('Reject')}</DButton></div>}
      >
        <DTextarea label={copy('Rejection note')} value={rejectionNote} onChange={setRejectionNote} />
      </DDialog>
    </BackofficePage>
  );
}
function ExpenseDetail({ item, onClose }: { item: Expense | null; onClose: () => void }) {
  const { copy, formatDate, formatMoney } = useBackofficeLocalization();
  const facts: Array<[string, string]> = item ? [
    [copy('Category'), expenseCategoryLabel(item.categoryCode, copy)],
    [copy('Amount'), formatMoney(item.amount, item.currency)],
    [copy('Occurred date'), formatDate(new Date(item.occurredAt), { dateStyle: 'medium' })],
    [copy('Source financial account'), item.financialAccountName],
    [copy('Location'), item.sellingLocationName],
    [copy('Description'), item.note || '—'],
    [copy('Origin'), copy(item.origin)],
    [copy('Requested by'), item.createdByActorId],
    [copy('Status'), item.status],
    ...(item.approvedAt ? [[copy('Approved by'), item.approvedByActorId || '—'] as [string, string], [copy('Decision time'), formatDate(new Date(item.approvedAt), { dateStyle: 'medium', timeStyle: 'short' })] as [string, string]] : []),
    ...(item.rejectedAt ? [[copy('Rejected by'), item.rejectedByActorId || '—'] as [string, string], [copy('Decision time'), formatDate(new Date(item.rejectedAt), { dateStyle: 'medium', timeStyle: 'short' })] as [string, string], [copy('Decision note'), item.rejectionNote || '—'] as [string, string]] : []),
  ] : [];
  const Field = ({ fact }: { fact: [string, string] }) => (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--color-text-muted)]">{fact[0]}</dt>
      <dd className="mt-1 break-words text-sm text-[var(--color-text)]">{fact[1]}</dd>
    </div>
  );
  return (
    <DDialog open={Boolean(item)} onClose={onClose} title={copy('Expense details')} footer={<div className="flex justify-end"><DButton variant="secondary" onClick={onClose}>{copy('Close')}</DButton></div>}>
      {item ? <div className="space-y-5">
        <section className="border-b border-[var(--color-border)] pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-medium text-[var(--color-text-muted)]">{copy('Amount')}</p><p className="mt-1 text-2xl font-bold tracking-tight">{formatMoney(item.amount, item.currency)}</p></div>
            <Badge status={item.status} />
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Field fact={facts[0]!} /><Field fact={facts[2]!} /></dl>
        </section>
        <section><h3 className="mb-3 text-sm font-semibold">{copy('Expense information')}</h3><dl className="grid gap-4 sm:grid-cols-2"><Field fact={facts[5]!} /><Field fact={facts[3]!} /><Field fact={facts[4]!} /></dl></section>
        <section className="border-t border-[var(--color-border)] pt-4"><h3 className="mb-3 text-sm font-semibold">{copy('Request information')}</h3><dl className="grid gap-4 sm:grid-cols-2"><Field fact={facts[6]!} /><Field fact={facts[7]!} /></dl></section>
        {facts.length > 9 ? <section className="border-t border-[var(--color-border)] pt-4"><h3 className="mb-3 text-sm font-semibold">{copy('Decision and audit')}</h3><dl className="grid gap-4 sm:grid-cols-2">{facts.slice(9).map((fact) => <Field key={fact[0]} fact={fact} />)}</dl></section> : null}
      </div> : null}
    </DDialog>
  );
}
function expenseCategoryLabel(categoryCode: string, copy: (value: string) => string) {
  const labels: Record<string, string> = { OPERATIONS: 'Operations', TRANSPORT: 'Transport', SUPPLIES: 'Supplies', OTHER: 'Other' };
  return copy(labels[categoryCode] ?? categoryCode);
}
function ExpenseDialog({
  item,
  api,
  ops,
  onClose,
  onSaved,
}: {
  item: Expense | null | undefined;
  api: ExpenseApi;
  ops: FinancialOperationsApi;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { copy } = useBackofficeLocalization();
  const { showToast } = useToast();
  const open = item !== undefined;
  const [locationId, setLocationId] = useState(item?.sellingLocationId ?? '');
  const [accountId, setAccountId] = useState(item?.financialAccountId ?? '');
  const [amount, setAmount] = useState(item?.amount ?? '');
  const [categoryCode, setCategoryCode] = useState(item?.categoryCode ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [date, setDate] = useState(item?.occurredAt ?? new Date().toISOString());
  const locations = useQuery({
    queryKey: ['expense-locations'],
    queryFn: () => ops.locations(),
    enabled: open,
  });
  const accounts = useQuery({
    queryKey: ['expense-accounts'],
    queryFn: () => ops.accounts(),
    enabled: open,
  });
  const save = async () => {
    try {
      const input = {
        sellingLocationId: locationId,
        financialAccountId: accountId,
        categoryCode,
        amount,
        note: note || null,
        occurredAt: date,
      };
      if (item) await api.update(item, input);
      else await api.create(input);
      showToast({
        variant: 'success',
        title: copy(item ? 'Expense updated.' : 'Expense recorded.'),
      });
      onSaved();
      onClose();
    } catch (e) {
      showToast({
        variant: 'danger',
        title: normalizeBackofficeApiError(e, copy('Could not save expense.')).safeMessage,
      });
    }
  };
  return (
    <DDialog
      open={open}
      onClose={onClose}
      title={copy(item ? 'Edit expense' : 'Record expense')}
      footer={
        <div className="flex justify-end gap-2">
          <DButton variant="secondary" onClick={onClose}>
            {copy('Cancel')}
          </DButton>
          <DButton disabled={!locationId || !accountId || !amount || !categoryCode} onClick={() => void save()}>
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
          onChange={(x) => setLocationId(String(x))}
        />
        <DSelect
          label={copy('Source financial account')}
          value={accountId}
          options={(accounts.data?.items ?? [])
            .filter((x) => x.status === 'ACTIVE' && ['CASH', 'BANK', 'E_WALLET'].includes(x.type))
            .map((x) => ({ value: x.id, label: x.name }))}
          onChange={(x) => setAccountId(String(x))}
        />
        <DSelect
          label={copy('Category')}
          value={categoryCode}
          options={[
            { value: 'OPERATIONS', label: copy('Operations') },
            { value: 'TRANSPORT', label: copy('Transport') },
            { value: 'SUPPLIES', label: copy('Supplies') },
            { value: 'OTHER', label: copy('Other') },
          ]}
          onChange={(x) => setCategoryCode(String(x))}
        />
        <DCurrencyInput label={copy('Amount')} value={amount} onValueChange={setAmount} />
        <DDatePicker label={copy('Date')} value={date} onChange={setDate} />
        <DTextarea
          label={copy('Description')}
          value={note}
          onChange={setNote}
          containerClassName="sm:col-span-2"
        />
      </div>
    </DDialog>
  );
}
function Badge({ status }: { status: Expense['status'] }) {
  const { copy } = useBackofficeLocalization();
  return (
    <DBadge
      variant={status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'secondary' : 'warning'}
    >
      {copy(status === 'PENDING' ? 'Pending' : status === 'APPROVED' ? 'Approved' : 'Rejected')}
    </DBadge>
  );
}
