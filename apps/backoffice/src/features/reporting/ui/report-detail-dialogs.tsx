import { useRuntime } from '@digvation/business-runtime';
import { DBadge, DInfoNote } from '@digvation/ui';
import { useMemo, type ReactNode } from 'react';

import { useBackofficeAuth } from '../../../auth/backoffice-auth-context';
import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import { TransactionDetailDialog, TransactionHistoryApi } from '../../transaction-history';
import type { ReportRow } from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import {
  BADGE_VARIANTS,
  type ReportDetail as ReportDetailKind,
  type ValueKind,
  type EnumName,
} from '../model/report-catalog';
import { enumLabel, formatActor, formatReportValue } from '../model/report-format';
import { EmployeePerformanceDialog, type EmployeeDetailScope } from './employee-performance-dialog';
import { DetailShell, UnavailableDetail } from './report-detail-shell';

/** Reporting is read-only: details open without any domain action. */
export function ReportDetail({
  kind,
  row,
  scope,
  open,
  onClose,
}: {
  kind: ReportDetailKind;
  row: ReportRow;
  /** The report's period and location, for drill-downs that read more than the row. */
  scope: EmployeeDetailScope;
  open: boolean;
  onClose: () => void;
}) {
  if (kind === 'employee')
    return (
      // One dialog instance per employee: paging and cached figures never carry over.
      <EmployeePerformanceDialog
        key={String(row.employeeId ?? '')}
        row={row}
        scope={scope}
        open={open}
        onClose={onClose}
      />
    );
  if (kind === 'transaction')
    return <ReportTransactionDetail row={row} open={open} onClose={onClose} />;
  const Body = {
    'component-usage': ComponentUsageBody,
    'product-commission': CommissionBody,
    payment: PaymentBody,
    tax: TaxBody,
  }[kind];
  return <Body row={row} open={open} onClose={onClose} />;
}

function ReportTransactionDetail({
  row,
  open,
  onClose,
}: {
  row: ReportRow;
  open: boolean;
  onClose: () => void;
}) {
  const { createApiClient } = useBackofficeAuth();
  const { apiBaseUrl } = useRuntime();
  const { copy } = useReportingLocalization();
  const api = useMemo(
    () => new TransactionHistoryApi(createApiClient(apiBaseUrl)),
    [apiBaseUrl, createApiClient],
  );
  if (!row.saleId)
    return <UnavailableDetail open={open} onClose={onClose} title={copy('Transaction detail')} />;
  return (
    <TransactionDetailDialog
      open={open}
      saleId={row.saleId ? String(row.saleId) : null}
      api={api}
      permissions={{ refund: false, reverse: false }}
      onClose={onClose}
      onChanged={() => undefined}
    />
  );
}

function useFacts(row: ReportRow) {
  const { copy, format } = useReportingLocalization();
  return {
    copy,
    value: (key: string, kind: ValueKind = 'text', enumName?: EnumName) =>
      formatReportValue(kind, row[key], format, enumName),
  };
}

/** A summary header card: identity, a quiet context line, and one emphasized figure. */
function SummaryPanel({
  identity,
  context,
  figureLabel,
  figure,
}: {
  identity: string;
  context: string;
  figureLabel: string;
  figure: string;
}) {
  return (
    <RecordPanel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold tracking-tight text-[var(--color-text)]">
            {identity}
          </h2>
          <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">{context}</p>
        </div>
        <div className="text-left sm:text-right">
          <RecordSectionLabel>{figureLabel}</RecordSectionLabel>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-text)]">
            {figure}
          </p>
        </div>
      </div>
    </RecordPanel>
  );
}

function FactsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <RecordPanel padded={false} ariaLabel={title}>
      <RecordPanelHeader title={title} />
      <RecordPanelBody className="grid gap-3 sm:grid-cols-2">{children}</RecordPanelBody>
    </RecordPanel>
  );
}

function TransactionFacts({ row, withInvoice = false }: { row: ReportRow; withInvoice?: boolean }) {
  const { copy, value } = useFacts(row);
  return (
    <FactsCard title={copy('Transaction')}>
      <RecordInfoTile label={copy('Transaction')} value={value('saleNumber')} mono />
      {withInvoice ? (
        <RecordInfoTile
          label={copy('Invoice')}
          value={row.invoiceNumber ? value('invoiceNumber') : null}
          mono
        />
      ) : null}
      <RecordInfoTile label={copy('Location')} value={value('sellingLocation')} />
      <RecordInfoTile
        label={copy('Occurred at')}
        value={row.occurredAt ? value('occurredAt', 'datetime') : null}
      />
    </FactsCard>
  );
}

function ComponentUsageBody({
  row,
  open,
  onClose,
}: {
  row: ReportRow;
  open: boolean;
  onClose: () => void;
}) {
  const { copy, value } = useFacts(row);
  const selected = row.componentSource === 'SALE_SELECTED';
  const source = enumLabel('componentSource', row.componentSource, copy);
  return (
    <DetailShell
      open={open}
      onClose={onClose}
      title={copy('Component usage detail')}
      badge={<DBadge variant={selected ? 'info' : 'secondary'}>{source}</DBadge>}
    >
      <SummaryPanel
        identity={[
          value('componentName'),
          row.componentVariantName ? value('componentVariantName') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        context={`${value('parentItemName')} · ${value('saleNumber')}`}
        figureLabel={copy('Total used')}
        figure={value('usedQuantity', 'quantity')}
      />
      <TransactionFacts row={row} />
      <FactsCard title={copy('Parent service')}>
        <RecordInfoTile label={copy('Service')} value={value('parentItemName')} />
        <RecordInfoTile
          label={copy('Variant')}
          value={row.parentVariantName ? value('parentVariantName') : null}
        />
      </FactsCard>
      <FactsCard title={copy('Component')}>
        <RecordInfoTile label={copy('Component')} value={value('componentName')} />
        <RecordInfoTile
          label={copy('Variant')}
          value={row.componentVariantName ? value('componentVariantName') : null}
        />
        <RecordInfoTile
          label={copy('Source')}
          value={
            row.fixedBomSource === 'SERVICE_VARIANT_OVERRIDE'
              ? `${source} · ${enumLabel('fixedBomSource', row.fixedBomSource, copy)}`
              : source
          }
          className="sm:col-span-2"
        />
      </FactsCard>
      <FactsCard title={copy('Usage')}>
        <RecordInfoTile
          label={copy('Quantity per unit')}
          value={row.quantityPerUnit ? value('quantityPerUnit', 'quantity') : null}
        />
        <RecordInfoTile
          label={copy('Service quantity')}
          value={value('parentQuantity', 'quantity')}
        />
        <RecordInfoTile label={copy('Total used')} value={value('usedQuantity', 'quantity')} />
        {selected ? (
          <>
            <RecordInfoTile
              label={copy('Selling unit price')}
              value={row.sellingUnitAmount ? value('sellingUnitAmount', 'money') : null}
            />
            <RecordInfoTile
              label={copy('Billed addition')}
              value={row.billedAmount ? value('billedAmount', 'money') : null}
            />
          </>
        ) : (
          <p className="self-center text-sm text-[var(--color-text-muted)] sm:col-span-2">
            {copy('Included with the service, not billed separately.')}
          </p>
        )}
      </FactsCard>
    </DetailShell>
  );
}

function CommissionBody({
  row,
  open,
  onClose,
}: {
  row: ReportRow;
  open: boolean;
  onClose: () => void;
}) {
  const { copy, value } = useFacts(row);
  const reversal = row.entryType === 'REVERSAL';
  return (
    <DetailShell
      open={open}
      onClose={onClose}
      title={copy('Commission detail')}
      badge={
        <DBadge variant={BADGE_VARIANTS[String(row.entryType)] ?? 'outline'}>
          {enumLabel('commissionEntry', row.entryType, copy)}
        </DBadge>
      }
    >
      <SummaryPanel
        identity={value('employeeName')}
        context={`${value('productName')} · ${value('saleNumber')}`}
        figureLabel={copy('Commission amount')}
        figure={value('commissionAmount', 'signedMoney')}
      />
      {reversal ? (
        <DInfoNote variant="warning">
          {copy('This entry reverses commission earned earlier for this sale.')}
        </DInfoNote>
      ) : null}
      <TransactionFacts row={row} />
      <FactsCard title={copy('Product')}>
        <RecordInfoTile label={copy('Product')} value={value('productName')} />
        <RecordInfoTile
          label={copy('Variant')}
          value={row.variantName ? value('variantName') : null}
        />
        <RecordInfoTile label={copy('Quantity')} value={value('quantity', 'quantity')} />
        <RecordInfoTile label={copy('Employee')} value={value('employeeName')} />
      </FactsCard>
      <FactsCard title={copy('Commission')}>
        <RecordInfoTile
          label={copy('Commission type')}
          value={enumLabel('commissionType', row.commissionType, copy)}
        />
        <RecordInfoTile
          label={copy('Commission per unit')}
          value={value('commissionPerUnit', 'money')}
        />
        <RecordInfoTile
          label={copy('Commission amount')}
          value={value('commissionAmount', 'signedMoney')}
          className="sm:col-span-2"
        />
      </FactsCard>
    </DetailShell>
  );
}

function PaymentBody({
  row,
  open,
  onClose,
}: {
  row: ReportRow;
  open: boolean;
  onClose: () => void;
}) {
  const { copy, value } = useFacts(row);
  const refund = row.kind === 'REFUND';
  const hasAmount = (key: string) => Boolean(row[key] && /[1-9]/.test(String(row[key])));
  return (
    <DetailShell
      open={open}
      onClose={onClose}
      title={copy(refund ? 'Refund detail' : 'Payment detail')}
      badge={
        refund ? (
          <DBadge variant={BADGE_VARIANTS.REFUND ?? 'info'}>
            {enumLabel('paymentKind', 'REFUND', copy)}
          </DBadge>
        ) : (
          <DBadge variant={BADGE_VARIANTS[String(row.status)] ?? 'outline'}>
            {enumLabel('paymentStatus', row.status, copy)}
          </DBadge>
        )
      }
    >
      <SummaryPanel
        identity={value('saleNumber')}
        context={[
          enumLabel('paymentMethod', row.method, copy),
          row.financialAccount ? value('financialAccount') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        figureLabel={copy('Amount')}
        figure={value('appliedAmount', 'signedMoney')}
      />
      {refund ? (
        <DInfoNote variant="info">
          {copy(
            'This refund returns money from an earlier successful payment of this transaction.',
          )}
        </DInfoNote>
      ) : null}
      <TransactionFacts row={row} withInvoice />
      <FactsCard title={copy(refund ? 'Refund' : 'Payment')}>
        <RecordInfoTile
          label={copy('Method')}
          value={enumLabel('paymentMethod', row.method, copy)}
        />
        <RecordInfoTile
          label={copy('Account')}
          value={row.financialAccount ? value('financialAccount') : null}
        />
        <RecordInfoTile label={copy('Amount')} value={value('appliedAmount', 'signedMoney')} />
        <RecordInfoTile
          label={copy('Status')}
          value={enumLabel('paymentStatus', row.status, copy)}
        />
        {hasAmount('tenderedAmount') ? (
          <RecordInfoTile label={copy('Cash received')} value={value('tenderedAmount', 'money')} />
        ) : null}
        {hasAmount('changeAmount') ? (
          <RecordInfoTile label={copy('Change')} value={value('changeAmount', 'money')} />
        ) : null}
        {row.providerReference && !refund ? (
          <RecordInfoTile
            label={copy('Provider reference')}
            value={value('providerReference')}
            mono
          />
        ) : null}
        <RecordInfoTile label={copy('Created by')} value={formatActor(row, 'createdBy', copy)} />
        {/* Settlement is its own fact: never shown as the creator when they differ. */}
        {row.settledBy || row.settledByPresence ? (
          <RecordInfoTile label={copy('Settled by')} value={formatActor(row, 'settledBy', copy)} />
        ) : null}
        <RecordInfoTile
          label={copy('Completed at')}
          value={row.terminalAt ? value('terminalAt', 'datetime') : null}
        />
      </FactsCard>
    </DetailShell>
  );
}

function TaxBody({ row, open, onClose }: { row: ReportRow; open: boolean; onClose: () => void }) {
  const { copy, value } = useFacts(row);
  return (
    <DetailShell
      open={open}
      onClose={onClose}
      title={copy('Tax detail')}
      badge={
        row.taxTreatment ? (
          <DBadge variant="outline">{enumLabel('taxTreatment', row.taxTreatment, copy)}</DBadge>
        ) : undefined
      }
    >
      <SummaryPanel
        identity={value('itemName')}
        context={`${value('saleNumber')} · ${value('sellingLocation')}`}
        figureLabel={copy('Tax amount')}
        figure={value('taxAmount', 'money')}
      />
      <TransactionFacts row={row} withInvoice />
      <FactsCard title={copy('Item')}>
        <RecordInfoTile label={copy('Item')} value={value('itemName')} />
        <RecordInfoTile
          label={copy('Variant')}
          value={row.variantName ? value('variantName') : null}
        />
        <RecordInfoTile
          label={copy('Quantity')}
          value={row.quantity ? value('quantity', 'quantity') : null}
        />
        <RecordInfoTile
          label={copy('Item code')}
          value={row.itemCode ? value('itemCode') : null}
          mono
        />
      </FactsCard>
      <FactsCard title={copy('Tax')}>
        <RecordInfoTile
          label={copy('Tax code')}
          value={row.taxCode ? value('taxCode') : null}
          mono
        />
        <RecordInfoTile label={copy('Tax name')} value={row.taxName ? value('taxName') : null} />
        <RecordInfoTile
          label={copy('Rate')}
          value={row.taxRate ? value('taxRate', 'percent') : null}
        />
        <RecordInfoTile
          label={copy('Treatment')}
          value={enumLabel('taxTreatment', row.taxTreatment, copy)}
        />
        <RecordInfoTile label={copy('Taxable base')} value={value('taxableBase', 'money')} />
        <RecordInfoTile label={copy('Tax amount')} value={value('taxAmount', 'money')} />
        <RecordInfoTile label={copy('Tax included')} value={value('includedTax', 'money')} />
        <RecordInfoTile label={copy('Tax added')} value={value('excludedTax', 'money')} />
      </FactsCard>
    </DetailShell>
  );
}
