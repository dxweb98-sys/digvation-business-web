import { DButton, DDialog, DSkeleton, useToast } from '@digvation/ui';
import { useQuery } from '@tanstack/react-query';
import { Info, RotateCcw, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { normalizeBackofficeApiError } from '../../../app/api/backoffice-api-error';
import { isSessionExpiredError } from '../../../auth/backoffice-auth-context';
import {
  RecordDialogTitle,
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { Sale, TransactionHistoryApi } from '../api/transaction-history-api';
import { useTransactionHistoryLocalization } from '../localization/use-transaction-history-localization';
import {
  transactionActionErrorKey,
  transactionActions,
  type ReverseBlock,
} from '../model/transaction-actions';
import { discountBreakdown } from '../model/transaction-adjustments';
import { membershipPresentation } from '../model/transaction-loyalty';
import { transactionStatusSummary } from '../model/transaction-summary';
import { TransactionDiscountBreakdown } from './transaction-discount-breakdown';
import { TransactionFinancialSummary } from './transaction-financial-summary';
import { TransactionItemsSection } from './transaction-items-section';
import { TransactionMembershipSection } from './transaction-membership-section';
import { TransactionPaymentsSection } from './transaction-payments-section';
import { SummaryBadge } from './transaction-presentation';
import { TransactionPaymentCorrectionDialog } from './transaction-payment-correction-dialog';
import { TransactionRefundDialog } from './transaction-refund-dialog';
import { TransactionReverseDialog } from './transaction-reverse-dialog';

export const transactionDetailKeys = {
  detail: (id: string | null) => ['transaction-history-detail', id] as const,
};

const REVERSE_BLOCK_COPY: Record<ReverseBlock, string> = {
  PAYMENT_PENDING: 'Resolve the pending payment before reversing this transaction.',
  REFUND_REQUIRED: 'Refund all completed payments before reversing this transaction.',
  PROVIDER_REFUND_REQUIRED:
    'Non-cash payments must be refunded through their provider, so this transaction can’t be reversed here yet.',
};

type ActionDialog = 'refund' | 'reverse' | 'correct' | null;

/**
 * Visibility (`open`) is separate from the selected transaction (`saleId`): the last transaction
 * stays rendered while the dialog fades out, and a newly selected one never shows another's data.
 */
export function TransactionDetailDialog({
  open,
  saleId,
  initialSale,
  api,
  permissions,
  onClose,
  onChanged,
}: {
  open: boolean;
  saleId: string | null;
  /** The list row of the selected transaction, rendered while its detail refreshes. */
  initialSale?: Sale | undefined;
  api: Pick<TransactionHistoryApi, 'get' | 'refundPayment' | 'reverse'> &
    Partial<Pick<TransactionHistoryApi, 'correctPayments' | 'paymentRoutes'>>;
  permissions: { refund: boolean; reverse: boolean; correct?: boolean };
  onClose: () => void;
  onChanged: () => void;
}) {
  const { copy } = useTransactionHistoryLocalization();
  const { showToast } = useToast();
  const [action, setAction] = useState<ActionDialog>(null);
  // A new session per opening resets the action dialog form without remounting it on close.
  const [actionSession, setActionSession] = useState(0);
  const detail = useQuery({
    queryKey: transactionDetailKeys.detail(saleId),
    queryFn: () => api.get(saleId!),
    enabled: open && Boolean(saleId),
    ...(initialSale && initialSale.id === saleId
      ? { initialData: initialSale, initialDataUpdatedAt: 0 }
      : {}),
  });
  const sale = detail.data && detail.data.id === saleId ? detail.data : undefined;
  const actions = sale ? transactionActions(sale, permissions) : null;
  const reverseHintId = `reverse-hint-${saleId ?? 'none'}`;
  // Payment routes the correction may attribute money to; only fetched when the dialog is opened.
  const correctionRoutes = useQuery({
    queryKey: ['transaction-correction-routes', sale?.sellingLocationId, sale?.currency],
    queryFn: () => api.paymentRoutes!(sale!.sellingLocationId, sale!.currency),
    enabled: action === 'correct' && Boolean(sale) && Boolean(api.paymentRoutes),
  });

  const openAction = (next: Exclude<ActionDialog, null>) => {
    setActionSession((session) => session + 1);
    setAction(next);
  };
  const close = () => {
    setAction(null);
    onClose();
  };

  /** Runs one command; resolves `null` on success, else the localized message to show. */
  const run = async (command: () => Promise<unknown>, success: string, fallback: string) => {
    try {
      await command();
      await detail.refetch();
      onChanged();
      setAction(null);
      showToast({ variant: 'success', title: copy(success) });
      return null;
    } catch (error) {
      if (isSessionExpiredError(error)) return null;
      return copy(transactionActionErrorKey(normalizeBackofficeApiError(error, '').code, fallback));
    }
  };

  return (
    <DDialog
      open={open}
      onClose={close}
      ariaLabel={copy('Transaction details')}
      // A nested refund/reversal dialog owns Escape and outside clicks while it is open.
      closeOnEscape={action === null}
      closeOnOverlay={action === null}
      size="xl"
      title={
        <RecordDialogTitle title={copy('Transaction details')}>
          {sale ? <SummaryBadge summary={transactionStatusSummary(sale)} /> : null}
        </RecordDialogTitle>
      }
      footer={
        <div className="space-y-2.5">
          {actions?.reverseBlock ? (
            <p
              id={reverseHintId}
              className="flex items-start gap-1.5 text-xs text-[var(--color-text-muted)] sm:justify-end"
            >
              <Info aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              <span>{copy(REVERSE_BLOCK_COPY[actions.reverseBlock])}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DButton variant="secondary" onClick={close}>
              {copy('Close')}
            </DButton>
            {actions && (actions.canRefund || actions.showReverse) ? (
              <div className="flex flex-wrap justify-end gap-2">
                {actions.canRefund ? (
                  <DButton
                    variant={actions.canReverse ? 'secondary' : 'primary'}
                    leftIcon={<Undo2 aria-hidden="true" className="size-4" />}
                    onClick={() => openAction('refund')}
                  >
                    {copy('Refund')}
                  </DButton>
                ) : null}
                {actions.showReverse ? (
                  <DButton
                    variant="danger"
                    leftIcon={<RotateCcw aria-hidden="true" className="size-4" />}
                    disabled={!actions.canReverse}
                    aria-describedby={actions.reverseBlock ? reverseHintId : undefined}
                    onClick={() => openAction('reverse')}
                  >
                    {copy('Reverse transaction')}
                  </DButton>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      }
    >
      {sale ? (
        <TransactionDetailBody
          sale={sale}
          onCorrectPayment={
            actions?.canCorrect && api.correctPayments ? () => openAction('correct') : undefined
          }
        />
      ) : detail.isError ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            {copy('Could not load transaction details.')}
          </p>
          <DButton
            variant="secondary"
            onClick={() => void detail.refetch()}
            loading={detail.isFetching}
          >
            {copy('Try again')}
          </DButton>
        </div>
      ) : (
        <TransactionDetailSkeleton label={copy('Loading transaction details...')} />
      )}
      {sale && actions ? (
        <>
          <TransactionRefundDialog
            key={`refund-${actionSession}`}
            open={action === 'refund'}
            refundable={actions.refundable}
            onClose={() => setAction(null)}
            onRefund={(paymentId, amount) =>
              run(
                () => api.refundPayment(sale.id, paymentId, sale.version, amount),
                'Payment refunded.',
                'Could not refund this payment.',
              )
            }
          />
          {api.correctPayments ? (
            <TransactionPaymentCorrectionDialog
              key={`correct-${actionSession}`}
              open={action === 'correct'}
              sale={sale}
              routes={correctionRoutes.data ?? []}
              onClose={() => setAction(null)}
              onCorrect={(request, key) =>
                run(
                  () => api.correctPayments!(sale.id, request, key),
                  'Payment correction saved.',
                  'Could not save the payment correction.',
                )
              }
            />
          ) : null}
          <TransactionReverseDialog
            key={`reverse-${actionSession}`}
            open={action === 'reverse'}
            onClose={() => setAction(null)}
            onReverse={(reason) =>
              run(
                () => api.reverse(sale.id, sale.version, reason),
                'Transaction reversed.',
                'Could not reverse this transaction.',
              )
            }
          />
        </>
      ) : null}
    </DDialog>
  );
}

/** Holds the dialog near its loaded size so opening never jumps from a one-line message. */
function TransactionDetailSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-4">
      <DSkeleton height={96} rounded="lg" />
      <DSkeleton height={220} rounded="lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <DSkeleton height={180} rounded="lg" />
        <DSkeleton height={180} rounded="lg" />
      </div>
    </div>
  );
}

function TransactionDetailBody({
  sale,
  onCorrectPayment,
}: {
  sale: Sale;
  /** Opens the payment correction; omitted unless the viewer may correct this Sale. */
  onCorrectPayment?: (() => void) | undefined;
}) {
  const { copy, formatDate, formatMoney, formatQuantity } = useTransactionHistoryLocalization();
  const dateTime = (value: string) =>
    formatDate(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  const breakdown = discountBreakdown(sale);
  const membership = membershipPresentation(sale);

  return (
    <div className="space-y-4">
      <RecordPanel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="break-all font-mono text-lg font-semibold tracking-tight text-[var(--color-text)] sm:text-xl">
              {sale.saleNumber}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {dateTime(sale.createdAt)}
              {sale.invoiceNumber ? (
                <>
                  {' · '}
                  {copy('Invoice')} <span className="font-mono">{sale.invoiceNumber}</span>
                </>
              ) : null}
            </p>
            {sale.customer ? (
              <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">
                {copy('Customer')}:{' '}
                <span className="font-medium text-[var(--color-text)]">{sale.customer.name}</span>
                {sale.customer.type === 'MEMBER' ? ` · ${copy('Member')}` : ''}
              </p>
            ) : null}
          </div>
          <div className="text-left sm:text-right">
            <RecordSectionLabel>{copy('Total')}</RecordSectionLabel>
            <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-[var(--color-text)] sm:text-3xl">
              {formatMoney(sale.totalAmount, sale.currency)}
            </p>
          </div>
        </div>
      </RecordPanel>

      <TransactionItemsSection sale={sale} adjustmentsByLine={breakdown.byLine} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RecordPanel ariaLabel={copy('Charges')} padded={false}>
          <RecordPanelHeader title={copy('Charges')} />
          <RecordPanelBody>
            <TransactionFinancialSummary
              sale={sale}
              copy={copy}
              formatMoney={formatMoney}
              formatQuantity={formatQuantity}
              discountDetails={
                <TransactionDiscountBreakdown breakdown={breakdown} currency={sale.currency} />
              }
            />
          </RecordPanelBody>
        </RecordPanel>
        <TransactionPaymentsSection sale={sale} onCorrectPayment={onCorrectPayment} />
      </div>

      {membership ? (
        <TransactionMembershipSection membership={membership} currency={sale.currency} />
      ) : null}

      {sale.reversal ? (
        <RecordPanel ariaLabel={copy('Reversal')} padded={false}>
          <RecordPanelHeader title={copy('Reversal')} />
          <RecordPanelBody className="grid gap-3 sm:grid-cols-2">
            <RecordInfoTile label={copy('Reason')} value={sale.reversal.reason} />
            <RecordInfoTile
              label={copy('Reversed on')}
              value={dateTime(sale.reversal.reversedAt)}
            />
          </RecordPanelBody>
        </RecordPanel>
      ) : null}
    </div>
  );
}
