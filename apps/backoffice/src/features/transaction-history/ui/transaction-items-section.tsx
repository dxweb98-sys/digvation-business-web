import { DBadge } from '@digvation/ui';

import { RecordPanel, RecordPanelBody, RecordPanelHeader } from '../../../shared/ui/record-dialog';
import type { Sale, SaleAdjustment } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import { ADJUSTMENT_SOURCE_LABELS } from '../model/transaction-adjustments';
import {
  retiredSaleLines,
  transactionItems,
  type TransactionItemPresentation,
} from '../model/transaction-lines';
import { fulfillmentStatusSummary, workSummary } from '../model/transaction-summary';
import { Attribution, EmployeeNames, SummaryBadge } from './transaction-presentation';

export function TransactionItemsSection({
  sale,
  adjustmentsByLine,
}: {
  sale: Sale;
  adjustmentsByLine: ReadonlyMap<string, SaleAdjustment[]>;
}) {
  const pointsAllocated = Boolean(sale.loyaltyRedemption);
  const { copy } = useTransactionHistoryLocalization();
  const items = transactionItems(sale);
  const retired = retiredSaleLines(sale);
  const work = workSummary(sale);
  // With one tracked line its own state is the section state; badge each line only when they differ.
  const trackedCount = items.filter((item) => item.line.fulfillment).length;

  return (
    <RecordPanel ariaLabel={copy('Transaction items')} padded={false}>
      <RecordPanelHeader
        title={copy('Transaction items')}
        count={items.length}
        trailing={work.kind === 'NONE' ? null : <SummaryBadge summary={work} />}
      />
      <RecordPanelBody className="py-1">
        <ul className="divide-y divide-[var(--color-border)]">
          {items.map((item) => (
            <TransactionItem
              key={item.line.id}
              item={item}
              currency={sale.currency}
              showWorkState={trackedCount > 1}
              adjustments={adjustmentsByLine.get(item.line.id) ?? []}
              pointsAllocated={pointsAllocated}
            />
          ))}
        </ul>
        {retired.length ? (
          <div className="mb-4 mt-1 rounded-xl border border-dashed border-[var(--color-border)] p-3.5">
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">
              {copy('Removed or corrected items')}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {copy('Not part of the billed total.')}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
              {retired.map((line) => (
                <RetiredLine key={line.id} line={line} />
              ))}
            </ul>
          </div>
        ) : null}
      </RecordPanelBody>
    </RecordPanel>
  );
}

function RetiredLine({ line }: { line: Sale['lines'][number] }) {
  const { formatQuantity } = useTransactionHistoryLocalization();
  return (
    <li className="flex justify-between gap-3">
      <span className="min-w-0 break-words line-through">
        {line.itemNameSnapshot}
        {line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}
      </span>
      <span className="shrink-0 tabular-nums">× {formatQuantity(line.quantity)}</span>
    </li>
  );
}

function TransactionItem({
  item,
  currency,
  showWorkState,
  adjustments,
  pointsAllocated,
}: {
  item: TransactionItemPresentation;
  currency: string;
  showWorkState: boolean;
  adjustments: readonly SaleAdjustment[];
  pointsAllocated: boolean;
}) {
  const { copy, formatMoney, formatQuantity } = useTransactionHistoryLocalization();
  const { line } = item;
  const lineAmount = line.grossAmount ?? line.totalAmount;
  // Runtime's discounted base equals "after item discounts" only when nothing else was allocated.
  const itemNet =
    adjustments.length &&
    !pointsAllocated &&
    line.discountedCustomerBaseAmount &&
    !/[1-9]/.test(line.orderDiscountAllocationAmount ?? '0')
      ? line.discountedCustomerBaseAmount
      : null;

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="break-words text-[15px] font-semibold leading-snug text-[var(--color-text)]">
              {line.itemNameSnapshot}
            </p>
            <DBadge variant="outline">{copy(item.isService ? 'Service' : 'Product')}</DBadge>
            {showWorkState && line.fulfillment ? (
              <SummaryBadge summary={fulfillmentStatusSummary(line.fulfillment.status)} />
            ) : null}
          </div>
          {line.variantNameSnapshot ? (
            <p className="mt-0.5 break-words text-sm text-[var(--color-text-muted)]">
              {line.variantNameSnapshot}
            </p>
          ) : null}
          <p className="mt-1 text-xs tabular-nums text-[var(--color-text-muted)]">
            {copy('Qty')} {formatQuantity(line.quantity)}
            {line.effectiveUnitPrice
              ? ` × ${formatMoney(line.effectiveUnitPrice, currency)} ${copy('each')}`
              : ''}
          </p>
        </div>
        {lineAmount ? (
          <div className="shrink-0 text-right tabular-nums">
            {itemNet ? (
              <p className="text-xs text-[var(--color-text-muted)] line-through">
                {formatMoney(lineAmount, currency)}
              </p>
            ) : null}
            <p className="font-semibold text-[var(--color-text)]">
              {formatMoney(itemNet ?? lineAmount, currency)}
            </p>
          </div>
        ) : null}
      </div>

      {adjustments.length ? (
        <dl className="mt-2 space-y-1 rounded-lg bg-[var(--color-surface-muted)]/50 px-3 py-2 text-xs">
          {adjustments.map((adjustment) => (
            <div key={adjustment.id} className="flex justify-between gap-3">
              <dt className="min-w-0 break-words text-[var(--color-text)]">
                {adjustment.label}
                {adjustment.label.trim().toLowerCase() ===
                copy(ADJUSTMENT_SOURCE_LABELS[adjustment.source]).toLowerCase() ? null : (
                  <span className="text-[var(--color-text-muted)]">
                    {' '}
                    · {copy(ADJUSTMENT_SOURCE_LABELS[adjustment.source])}
                  </span>
                )}
              </dt>
              <dd className="shrink-0 tabular-nums text-[var(--color-danger)]">
                −{formatMoney(adjustment.actualAmount, currency)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {item.isService ? (
        item.workUnits.length ? (
          <ul className="mt-1.5 space-y-0.5">
            {item.workUnits.map((unit) => (
              <li key={unit.unitNumber}>
                <Attribution label={`${copy('Unit')} ${unit.unitNumber} · ${copy('Worked by')}`}>
                  <EmployeeNames names={unit.performers} />
                </Attribution>
              </li>
            ))}
          </ul>
        ) : (
          <Attribution label={copy('Worked by')}>
            <EmployeeNames names={item.performers} />
          </Attribution>
        )
      ) : item.soldBy ? (
        <Attribution label={copy('Sold by')}>{item.soldBy}</Attribution>
      ) : null}

      {item.additionalComponents.length ? (
        <div className="mt-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
            {copy('Additional items')}
          </p>
          <ul className="mt-1.5 space-y-2">
            {item.additionalComponents.map((component) => (
              <li key={component.id} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 break-words text-[var(--color-text)]">
                    <span className="font-medium">{component.name}</span>
                    {component.variant ? (
                      <span className="text-[var(--color-text-muted)]"> · {component.variant}</span>
                    ) : null}
                    <span className="tabular-nums text-[var(--color-text-muted)]">
                      {' '}
                      × {formatQuantity(component.quantity)}
                      {line.quantity && !/^1(\.0+)?$/.test(line.quantity)
                        ? ` ${copy('per unit')}`
                        : ''}
                    </span>
                  </p>
                  <p className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                    {component.chargedAmount
                      ? formatMoney(component.chargedAmount, currency)
                      : copy('Included in service price')}
                  </p>
                </div>
                <Attribution label={copy('Worked by')}>
                  <EmployeeNames names={component.performers} />
                </Attribution>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}
