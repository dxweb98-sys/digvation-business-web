import { ApiError } from '@digvation/pos-api';
import { DAlert, DButton as Button, DDialog as Dialog, useToast } from '@digvation-labs/ui';
import { Plus } from 'lucide-react';
import { useReducer, useState } from 'react';

import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import { replacementLinesOf } from '../cart/cart-draft';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../cart/item-configurator';
import {
  cashierTransactionErrorMessage,
  correctionErrorMessage,
  isApiErrorCode,
  isSaleVersionConflict,
  orderAdjustmentIssueMessage,
} from '../transaction/api/cashier-transaction-errors';
import type {
  OrderAdjustmentCommitInput,
  OrderAdjustmentPreview,
  OrderAdjustmentResult,
  ReplaceLinePreview,
  ReplaceSaleLineInput,
} from '../transaction/api/cashier-transaction.adapter';
import type {
  CatalogItem,
  ComponentCandidate,
  Employee,
  PaymentRoute,
  Sale,
  SaleLine,
} from '../transaction/model/cashier-transaction.types';
import { transactionNumber } from '../transaction/model/sale-display';
import { saleLineConfiguration } from '../transaction/model/sale-line-additions';
import { hasSuccessfulPayment } from '../payment/sale-payment-status';
import { ItemCorrectionDialog } from './item-correction-dialog';
import {
  adjustOrderDraft,
  draftOperationFor,
  emptyOrderAdjustmentDraft,
  orderAdjustmentInput,
} from './order-adjustment-draft';
import { OrderAdjustmentFooter } from './order-adjustment-footer';
import {
  AUTHORITY_ISSUE_CODES,
  OrderAdjustmentAuthorityAlert,
  OrderAdjustmentImpact,
} from './order-adjustment-impact';
import {
  defaultRefundDisbursement,
  RefundDisbursementPicker,
  refundDisbursementInput,
  type RefundDisbursementDraft,
} from './refund-disbursement-picker';
import { OrderAdjustmentLine } from './order-adjustment-line';
import { AddTransactionItemDialog } from './transaction-item-dialog';
import { useItemCorrection } from './use-item-correction';
import {
  type PreviewOrderAdjustment,
  useOrderAdjustmentPreview,
} from './use-order-adjustment-preview';

/**
 * Adjusting a queued Sale as one draft. Every change stays in this dialog and only Runtime prices
 * it; the persisted Sale and its queue card do not change while the operator edits. Batal discards
 * the draft; Simpan penyesuaian saves all of it at once, or nothing.
 */
export function ReferenceOrderAdjustmentDialog({
  sale,
  items,
  locale,
  isMutating: mutating,
  onClose,
  onPreview,
  onCommit,
  onCommitted,
  onReload,
  loadConfiguratorState,
  loadCandidates,
  canAdjust,
  paymentRoutes,
  employees = [],
}: {
  /** The persisted Sale being adjusted; the draft never changes it. */
  sale: Sale | null;
  /** Service performers, to name who performs a Service's additional items. */
  employees?: readonly Employee[];
  /**
   * Every active standalone sellable item. Never the POS page's filtered catalog: adding or
   * correcting an item has its own Product/Service choice and search.
   */
  items: readonly CatalogItem[];
  locale: string;
  isMutating: boolean;
  /** Closes the adjustment; with a draft, this discards it and saves nothing. */
  onClose: () => void;
  /** Runtime's read-only impact of the draft. */
  onPreview: PreviewOrderAdjustment;
  /** Saves the whole draft atomically; nothing is saved when it fails. */
  onCommit: (
    saleId: string,
    input: OrderAdjustmentCommitInput,
    idempotencyKey: string,
  ) => Promise<OrderAdjustmentResult>;
  /** The saved adjustment: Runtime's Sale replaces the persisted one. */
  onCommitted: (result: OrderAdjustmentResult) => void;
  /** Reloads the persisted Sale after it changed elsewhere. */
  onReload: (saleId: string) => Promise<Sale>;
  /** Everything the shared item configuration needs for one item at this location. */
  loadConfiguratorState: (item: CatalogItem) => Promise<ItemConfiguratorState>;
  loadCandidates: (q: string) => Promise<{ items: ComponentCandidate[] }>;
  /** Session may adjust this Sale in its current state (see `canAdjustOrder`). */
  canAdjust: boolean;
  /** The location's payment routes; a refund leaves through one of its cash or bank routes. */
  paymentRoutes: readonly PaymentRoute[];
}) {
  const { copy } = useOperationalLocalization();
  const { showToast } = useToast();
  const [draft, dispatch] = useReducer(
    adjustOrderDraft,
    sale?.version ?? 0,
    emptyOrderAdjustmentDraft,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [reloading, setReloading] = useState(false);
  // One idempotency key per exact save request, so a retry of the same draft never saves twice.
  const [attempt, setAttempt] = useState<{ request: string; key: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  // Edit of a line in the shared item configuration.
  const [editLine, setEditLine] = useState<SaleLine | null>(null);
  const [editState, setEditState] = useState<ItemConfiguratorState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // How a refund is returned; until the operator changes it, the first available account.
  const [disbursementChoice, setDisbursement] = useState<RefundDisbursementDraft | null>(null);
  const disbursement = disbursementChoice ?? defaultRefundDisbursement(paymentRoutes);

  const input = sale ? orderAdjustmentInput(draft) : null;
  const preview = useOrderAdjustmentPreview({
    preview: onPreview,
    saleId: sale?.id ?? '',
    input,
  });
  // Without the adjustment permission every editing control is off; closing stays available.
  const isMutating = mutating || !canAdjust || saving;
  const shown = input ? preview.shown : null;
  const displaySale = shown?.proposedSale ?? sale;
  const originOf = (lineId: string) => shown?.lines.find((origin) => origin.lineId === lineId);
  const persistedLine = (lineId: string) =>
    sale?.lines.find((line) => line.id === lineId && line.removedAt === null);
  /** The line as the operator just set it: a changed quantity shows before Runtime prices it. */
  const withDraftQuantity = (line: SaleLine): SaleLine => {
    const origin = originOf(line.id);
    const operation = origin?.clientKey
      ? draft.operations.find(
          (entry) => entry.kind === 'ADD' && entry.clientKey === origin.clientKey,
        )
      : draftOperationFor(draft, origin?.replacesLineId ?? line.id);
    const quantity =
      operation?.kind === 'QUANTITY'
        ? operation.quantity
        : (operation?.kind === 'ADD' || operation?.kind === 'REPLACE') &&
            operation.lines.length === 1 &&
            (origin?.clientKey || origin?.replacesLineId)
          ? operation.lines[0]!.quantity
          : line.quantity;
    return quantity === line.quantity ? line : { ...line, quantity };
  };

  /** Runtime's impact of the draft with one correction in it, as the correction dialog shows it. */
  const previewCorrection = async (
    line: SaleLine,
    proposed: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ): Promise<ReplaceLinePreview> => {
    const existing = draftOperationFor(draft, line.id);
    const operations = [
      ...draft.operations.filter((operation) => operation !== existing),
      { kind: 'REPLACE' as const, lineId: line.id, ...proposed },
    ];
    const result = await onPreview(sale!.id, {
      expectedVersion: draft.baseVersion,
      operations,
    });
    const issue =
      result.issues.find((entry) => entry.operationIndex === operations.length - 1) ??
      result.issues.find((entry) => entry.operationIndex === null);
    if (issue) throw new ApiError(409, issue.code, issue.message);
    return correctionImpactOf(result, line.id);
  };
  const { correction, previewRef } = useItemCorrection({
    items,
    locale,
    loadConfiguratorState,
    onPreview: previewCorrection,
    onConfirm: (line, confirmed) =>
      dispatch({
        type: 'REPLACE',
        lineId: line.id,
        lines: confirmed.lines,
        reason: confirmed.reason,
      }),
  });

  const changeQuantity = (line: SaleLine, quantity: string) => {
    const origin = originOf(line.id);
    if (origin?.clientKey) {
      const added = draft.operations.find(
        (operation) => operation.kind === 'ADD' && operation.clientKey === origin.clientKey,
      );
      // An item configured into several lines changes through its configuration instead.
      if (added?.kind === 'ADD' && added.lines.length === 1)
        dispatch({
          type: 'EDIT_ADDED',
          clientKey: origin.clientKey,
          lines: [{ ...added.lines[0]!, quantity }],
        });
      return;
    }
    if (origin?.replacesLineId) {
      const replaced = draftOperationFor(draft, origin.replacesLineId);
      if (replaced?.kind === 'REPLACE' && replaced.lines.length === 1)
        dispatch({
          type: 'REPLACE',
          lineId: origin.replacesLineId,
          lines: [{ ...replaced.lines[0]!, quantity }],
          ...(replaced.reason ? { reason: replaced.reason } : {}),
        });
      return;
    }
    const persisted = persistedLine(line.id);
    if (persisted)
      dispatch({
        type: 'QUANTITY',
        lineId: line.id,
        quantity,
        persistedQuantity: persisted.quantity,
      });
  };
  const removeLine = (line: SaleLine) => {
    const origin = originOf(line.id);
    if (origin?.clientKey) dispatch({ type: 'REMOVE_ADDED', clientKey: origin.clientKey });
    else dispatch({ type: 'REMOVE', lineId: origin?.replacesLineId ?? line.id });
  };
  const openEdit = (line: SaleLine) => {
    const item = items.find((entry) => entry.id === line.catalogItemId);
    if (!item) return;
    setEditError(null);
    setEditState(null);
    setEditLine(line);
    void loadConfiguratorState(item)
      .then(setEditState)
      .catch((error: unknown) => {
        setEditLine(null);
        setEditError(cashierTransactionErrorMessage(error));
      });
  };
  const closeEdit = () => {
    setEditLine(null);
    setEditState(null);
  };
  const confirmEdit = (configuration: ItemConfiguration) => {
    if (!editLine || !editState) return;
    const lines = replacementLinesOf(editState.item.id, configuration.catalogVariantId, {
      ...configuration,
      soldByEmployeeId: configuration.soldBy?.employeeId ?? null,
    });
    const origin = originOf(editLine.id);
    closeEdit();
    if (origin?.clientKey) {
      dispatch({ type: 'EDIT_ADDED', clientKey: origin.clientKey, lines });
      return;
    }
    const lineId = origin?.replacesLineId ?? editLine.id;
    const replaced = draftOperationFor(draft, lineId);
    dispatch({
      type: 'REPLACE',
      lineId,
      lines,
      ...(replaced?.kind === 'REPLACE' && replaced.reason ? { reason: replaced.reason } : {}),
    });
  };

  const reviewed = preview.current;
  // Runtime's permission result for this session; commitAllowed already reflects it.
  // Runtime's authority results for this session; commitAllowed already reflects them.
  const authorityBlocked = Boolean(
    reviewed &&
    ((reviewed.settlement.refundPermissionRequired &&
      !reviewed.settlement.refundPermissionGranted) ||
      (reviewed.settlement.voidRequired && !reviewed.settlement.voidPermissionGranted)),
  );
  const disbursementMissing = Boolean(
    reviewed?.settlement.refundDisbursementRequired && !disbursement,
  );
  const canSave = Boolean(
    input &&
    reviewed &&
    reviewed.commitAllowed &&
    !authorityBlocked &&
    !disbursementMissing &&
    !preview.calculating &&
    !mutating &&
    canAdjust &&
    !conflict,
  );
  const save = () => {
    if (!sale || !input || !reviewed || saving) return;
    const request: OrderAdjustmentCommitInput = {
      ...input,
      acknowledgement: {
        previewVersion: reviewed.saleVersion,
        consequence: reviewed.settlement.consequence,
        amount: reviewed.settlement.amount,
        proposedTotalAmount: reviewed.proposedSale.totalAmount,
      },
      ...(reviewed.settlement.refundDisbursementRequired && disbursement
        ? { refundDisbursement: refundDisbursementInput(disbursement) }
        : {}),
    };
    const signature = JSON.stringify(request);
    const key =
      attempt?.request === signature
        ? attempt.key
        : `cashier-order-adjustment-${crypto.randomUUID()}`;
    setAttempt({ request: signature, key });
    setSaving(true);
    setSaveError(null);
    void onCommit(sale.id, request, key)
      .then((result) => {
        showToast({
          title: copy(
            result.sale.status === 'VOIDED' ? 'Transaction canceled' : 'Adjustment saved',
          ),
          description: transactionNumber(result.sale, locale),
          variant: 'success',
        });
        onCommitted(result);
      })
      .catch((error: unknown) => {
        setSaving(false);
        setSaveError(
          correctionErrorMessage(
            error,
            copy('The adjustment could not be saved. Try again.'),
            locale,
          ),
        );
        if (isSaleVersionConflict(error)) setConflict(true);
        if (isApiErrorCode(error, 'ADJUSTMENT_PREVIEW_STALE')) preview.recalculate();
      });
  };
  const reload = () => {
    if (!sale) return;
    setReloading(true);
    void onReload(sale.id)
      .then((fresh) => {
        // The same proposed changes now apply to the reloaded Sale; Runtime prices them again.
        dispatch({ type: 'REBASE', baseVersion: fresh.version });
        setConflict(false);
        setSaveError(null);
      })
      .catch((error: unknown) => setSaveError(cashierTransactionErrorMessage(error, locale)))
      .finally(() => setReloading(false));
  };
  const close = () => {
    if (!saving) onClose();
  };

  if (!sale || !displaySale) return null;

  const activeLines = displaySale.lines
    .filter((line) => line.removedAt === null)
    .map(withDraftQuantity);
  const removedCount = draft.operations.filter((operation) => operation.kind === 'REMOVE').length;
  // Authority issues are explained by the authority alert, never as a generic issue.
  const issues = (shown?.issues ?? []).filter(
    (issue) => !AUTHORITY_ISSUE_CODES.includes(issue.code),
  );

  return (
    <>
      <Dialog
        open
        onClose={close}
        title={copy('Adjust order')}
        description={transactionNumber(sale, locale)}
        ariaLabel={copy('Adjust order')}
        closeOnEscape
        closeOnOverlay
        className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
        footer={
          <OrderAdjustmentFooter
            sale={sale}
            preview={shown}
            locale={locale}
            saving={saving}
            canSave={canSave}
            onSave={save}
            onCancel={close}
          />
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {copy(
              hasSuccessfulPayment(sale)
                ? 'Changes are saved together when you save the adjustment. Items already paid stay on the payment record.'
                : 'Changes are saved together when you save the adjustment.',
            )}
          </p>
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {activeLines.map((line) => {
              const persisted = persistedLine(line.id);
              return (
                <OrderAdjustmentLine
                  key={line.id}
                  sale={displaySale}
                  line={line}
                  addedInThisAdjustment={!persisted}
                  baselineQuantity={persisted?.quantity}
                  sellable={items.some((item) => item.id === line.catalogItemId)}
                  employees={employees}
                  locale={locale}
                  isMutating={isMutating}
                  onQuantity={changeQuantity}
                  onRemove={removeLine}
                  onEdit={openEdit}
                  onStartCorrection={correction.start}
                />
              );
            })}
          </ul>
          {removedCount ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              {removedCount} {copy('items removed')}
            </p>
          ) : null}
          {editError ? <DAlert variant="danger">{editError}</DAlert> : null}

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={isMutating}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            {copy('Add item')}
          </button>

          {input && preview.failed ? (
            <DAlert variant="danger">
              <span className="flex flex-wrap items-center justify-between gap-2">
                {copy('The adjustment could not be calculated. Try again.')}
                <Button size="sm" variant="outline" onClick={preview.recalculate}>
                  {copy('Recalculate')}
                </Button>
              </span>
            </DAlert>
          ) : null}
          {input && !shown && preview.calculating ? (
            <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">
              {copy('Calculating the adjustment…')}
            </p>
          ) : null}
          {shown ? <OrderAdjustmentImpact preview={shown} sale={sale} locale={locale} /> : null}
          {shown?.settlement.refundDisbursementRequired ? (
            <RefundDisbursementPicker
              amount={shown.settlement.refundAmount}
              routes={paymentRoutes}
              value={disbursement}
              onChange={setDisbursement}
              locale={locale}
              disabled={saving}
            />
          ) : null}
          {issues.length ? (
            <DAlert variant="danger">
              <ul className="space-y-1">
                {issues.map((issue, index) => (
                  <li key={`${issue.code}-${issue.operationIndex ?? 'all'}-${index}`}>
                    {orderAdjustmentIssueMessage(issue.code, locale)}
                  </li>
                ))}
              </ul>
            </DAlert>
          ) : null}
          {shown ? <OrderAdjustmentAuthorityAlert preview={shown} locale={locale} /> : null}
          {saveError ? (
            <DAlert variant="danger">
              <span className="flex flex-wrap items-center justify-between gap-2">
                {saveError}
                {conflict ? (
                  <Button size="sm" variant="outline" loading={reloading} onClick={reload}>
                    {copy('Reload transaction')}
                  </Button>
                ) : null}
              </span>
            </DAlert>
          ) : null}
        </div>
      </Dialog>
      {correction.line ? (
        <ItemCorrectionDialog
          correction={correction}
          previewRef={previewRef}
          line={correction.line}
          sale={sale}
          items={items}
          employees={employees}
          locale={locale}
          isMutating={isMutating}
          loadCandidates={loadCandidates}
        />
      ) : null}
      {editLine && editState ? (
        <ItemConfigurator
          {...editState}
          initial={saleLineConfiguration(editLine, employees)}
          confirmLabel={copy('Save changes')}
          loadCandidates={loadCandidates}
          onConfirm={confirmEdit}
          onClose={closeEdit}
        />
      ) : null}
      {addOpen ? (
        <AddTransactionItemDialog
          items={items}
          locale={locale}
          loadConfiguratorState={loadConfiguratorState}
          loadCandidates={loadCandidates}
          onConfirm={(item, configuration) => {
            dispatch({
              type: 'ADD',
              clientKey: `draft-${crypto.randomUUID()}`,
              lines: replacementLinesOf(item.id, configuration.catalogVariantId, {
                ...configuration,
                soldByEmployeeId: configuration.soldBy?.employeeId ?? null,
              }),
            });
            return Promise.resolve();
          }}
          onClose={() => setAddOpen(false)}
        />
      ) : null}
    </>
  );
}

/** The draft's impact as the correction dialog presents it: the replacement lines and the money. */
function correctionImpactOf(
  preview: OrderAdjustmentPreview,
  sourceLineId: string,
): ReplaceLinePreview {
  const { settlement } = preview;
  const replacementIds = new Set(
    preview.lines
      .filter((origin) => origin.replacesLineId === sourceLineId)
      .map((origin) => origin.lineId),
  );
  return {
    saleId: preview.saleId,
    saleVersion: preview.saleVersion,
    currency: preview.currency,
    currentTotalAmount: preview.current.totalAmount,
    correctedTotalAmount: preview.proposedSale.totalAmount,
    netSuccessfulPaidAmount: preview.current.paidAmount,
    remainingPaymentAmount:
      settlement.consequence === 'ADDITIONAL_PAYMENT_REQUIRED' ? settlement.amount : '0.0000',
    refundAmount: settlement.refundAmount,
    replacements: preview.proposedSale.lines
      .filter((line) => replacementIds.has(line.id) && line.removedAt === null)
      .map((line) => ({
        catalogItemId: line.catalogItemId,
        itemName: line.itemNameSnapshot,
        variantName: line.variantNameSnapshot ?? null,
        quantity: line.quantity,
        unitAmount: line.effectiveUnitPrice,
        grossAmount: line.grossAmount,
        additions: (line.compositionComponents ?? [])
          .filter((component) => component.componentSource === 'SALE_SELECTED')
          .map((component) => ({
            name: [component.itemNameSnapshot, component.variantNameSnapshot]
              .filter(Boolean)
              .join(' / '),
            quantity: component.quantity,
            unitPrice: component.transactionUnitPrice ?? '0.0000',
            amount: component.extendedContribution,
          })),
      })),
  };
}
