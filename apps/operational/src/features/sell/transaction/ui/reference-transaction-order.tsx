import { DButton } from '@digvation-labs/ui';
import { PlayCircle, ShoppingBag } from 'lucide-react';
import { useOperationalLocalization } from '../../../../app/localization/operational-localization';
import { additionPerformedBy, saleLineAdditions, saleLineBase } from '../model/sale-line-additions';
import { saleLineWorkStatus } from '../../queue/queued-sale-work';
import { correctionSourceOf } from '../../adjustment/sale-adjustment-access';
import { lineDiscountRows } from '../model/sale-presentation';
import type { Employee, Sale, SaleLine } from '../model/cashier-transaction.types';
import {
  SaleDetailSection,
  SaleLineAdditions,
  SaleLineItem,
  SaleLineItemList,
  StatusPill,
} from './sale-detail-presentation';
import { serviceWorkUnitCount } from '../../performer/service-performers-dialog';
import { servicePerformerSummary } from '../../performer/service-performer-summary';
import { type QueueStatus, queueStatus } from '../../queue/queue-status';
import { employeeAssignmentIssues } from '../../queue/workflow-issues';
import { money, formatDurationMinutes, quantity } from '../model/sale-display';
import { pointQuantity } from '../model/sale-points';
import { DiscountDetailsContent, DiscountInfoTooltip } from './discount-details';
import { ServicePerformers } from '../../performer/service-performer-credits';

/** The line status a transaction state already implies, so it is not repeated per item. */
const impliedLineWorkStatus: Partial<Record<QueueStatus, string>> = {
  QUEUED: 'WAITING',
  PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELED: 'CANCELED',
};

const fulfillmentTone: Record<string, 'neutral' | 'brand' | 'success' | 'warning' | 'danger'> = {
  WAITING: 'warning',
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  CANCELED: 'danger',
};

type OrderLineProps = {
  sale: Sale;
  line: SaleLine;
  employees: readonly Employee[];
  locale: string;
  isMutating: boolean;
  onAssign: (line: SaleLine) => void;
  onStartLineWork: (line: SaleLine) => void;
};

function ReferenceTransactionOrderLine({
  sale,
  line,
  employees,
  locale,
  isMutating,
  onAssign,
  onStartLineWork,
}: OrderLineProps) {
  const { copy, label } = useOperationalLocalization();
  const status = queueStatus(sale);
  const format = (amount: string) => money(amount, locale);
  const isTrackedService =
    line.itemTypeSnapshot === 'SERVICE' &&
    line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
    line.fulfillment !== null;
  const requiresEmployeeAttribution =
    line.employeeAssignmentModeSnapshot !== 'NONE' || line.allowEmployeeContributionSnapshot;
  const attributed = isTrackedService && requiresEmployeeAttribution;
  const plannedUnits = line.workUnits?.length ?? 0;
  const needsAttention =
    attributed &&
    (employeeAssignmentIssues(line, locale).length > 0 ||
      (plannedUnits > 0 && plannedUnits !== serviceWorkUnitCount(line)));
  const durationLabel = formatDurationMinutes(line.defaultDurationMinutesSnapshot, locale);
  const workSummary = attributed ? servicePerformerSummary(line, employees, locale) : null;
  const editable = attributed && status === 'PROGRESS';
  // The transaction's own state already says "in progress"; a line only
  // repeats it when it differs (waiting, completed, canceled).
  const showWorkStatus =
    saleLineWorkStatus(line) !== null &&
    saleLineWorkStatus(line) !== (status ? impliedLineWorkStatus[status] : undefined);
  // The transaction is already IN_PROGRESS, but this specific tracked
  // Service has not been started yet: it needs its own explicit action.
  const canStartLineWork =
    status === 'PROGRESS' &&
    line.itemTypeSnapshot === 'SERVICE' &&
    line.fulfillmentBehaviorSnapshot === 'TRACKED' &&
    line.fulfillment?.status === 'WAITING';
  const additions = saleLineAdditions(line);
  const lineBase = saleLineBase(line, additions);
  return (
    <SaleLineItem
      name={line.itemNameSnapshot}
      variant={
        [
          line.variantNameSnapshot,
          line.soldByEmployeeNameSnapshot
            ? `${copy('Sold by')} ${line.soldByEmployeeNameSnapshot}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || null
      }
      pricing={`${quantity(line.quantity)} × ${format(line.effectiveUnitPrice)}`}
      amount={format(line.grossAmount)}
      discountsHeading={copy('Discounts and promotions')}
      discounts={lineDiscountRows(sale, line, copy('Discount')).map((row) => ({
        id: row.id,
        title: row.title,
        note: row.note,
        amount: format(row.amount),
        info: (
          <DiscountInfoTooltip
            label={copy('Discount details')}
            content={<DiscountDetailsContent details={row.details} locale={locale} />}
          />
        ),
      }))}
      usage={
        additions.length ? (
          <SaleLineAdditions
            heading={copy('Additional items')}
            baseLabel={copy('Item price')}
            base={{
              pricing: `${quantity(line.quantity)} × ${format(lineBase.unitPrice)}`,
              amount: format(lineBase.amount),
            }}
            rows={additions.map((addition) => ({
              id: addition.id,
              name: addition.name,
              pricing: `${quantity(addition.quantity)} × ${format(addition.unitPrice)}`,
              amount: format(addition.amount),
              performedBy: additionPerformedBy(addition, employees, copy),
            }))}
          />
        ) : null
      }
      earning={
        line.loyaltyEarning
          ? `${
              line.loyaltyEarning.state === 'FINALIZED'
                ? `${copy('Points earned')}: `
                : `${copy('Point preview')}: `
            }+${pointQuantity(line.loyaltyEarning.pointsEarned, locale)} ${copy('points')}`
          : null
      }
      context={
        showWorkStatus || line.workLineage || correctionSourceOf(sale, line) || durationLabel ? (
          <>
            {showWorkStatus ? (
              <StatusPill tone={fulfillmentTone[saleLineWorkStatus(line)!] ?? 'neutral'}>
                {label(saleLineWorkStatus(line)!)}
              </StatusPill>
            ) : null}
            {line.workLineage ? (
              <span>Pekerjaan tercatat pada {line.workLineage.sourceItemName}</span>
            ) : null}
            {correctionSourceOf(sale, line) ? (
              <span>Koreksi dari {correctionSourceOf(sale, line)!.itemNameSnapshot}</span>
            ) : null}
            {durationLabel ? <span>{durationLabel}</span> : null}
          </>
        ) : null
      }
      detail={
        workSummary ? (
          <ServicePerformers
            itemName={line.itemNameSnapshot}
            summary={workSummary}
            needsAttention={needsAttention}
            editable={editable}
            disabled={isMutating}
            onEdit={() => onAssign(line)}
          />
        ) : null
      }
      action={
        canStartLineWork ? (
          <DButton
            size="sm"
            variant="secondary"
            className="h-7 px-2.5 text-[11px]"
            leftIcon={<PlayCircle className="size-3.5" />}
            loading={isMutating}
            onClick={() => onStartLineWork(line)}
          >
            {copy('Start work')}
          </DButton>
        ) : null
      }
    />
  );
}

/** The read-only Order section: every active Sale line with its pricing, work and discounts. */
export function ReferenceTransactionOrder({
  sale,
  activeLines,
  employees,
  locale,
  isMutating,
  onAssign,
  onStartLineWork,
}: Omit<OrderLineProps, 'line'> & { activeLines: readonly SaleLine[] }) {
  const { copy } = useOperationalLocalization();
  return (
    <SaleDetailSection
      title={copy('Order')}
      icon={<ShoppingBag className="size-4" />}
      aside={`${activeLines.length} ${copy('items')}`}
    >
      <SaleLineItemList>
        {activeLines.map((line) => (
          <ReferenceTransactionOrderLine
            key={line.id}
            sale={sale}
            line={line}
            employees={employees}
            locale={locale}
            isMutating={isMutating}
            onAssign={onAssign}
            onStartLineWork={onStartLineWork}
          />
        ))}
      </SaleLineItemList>
    </SaleDetailSection>
  );
}
