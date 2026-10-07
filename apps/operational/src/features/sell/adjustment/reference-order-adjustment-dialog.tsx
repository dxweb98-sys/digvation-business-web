import { createDecimal } from '@digvation/pos-money';
import { DAlert, DDialog as Dialog } from '@digvation-labs/ui';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import {
  cashierTransactionErrorMessage,
  correctionErrorMessage,
} from '../transaction/api/cashier-transaction-errors';
import type {
  ReplaceLinePreview,
  ReplaceSaleLineInput,
} from '../transaction/api/cashier-transaction.adapter';
import { replacementLinesOf } from '../cart/cart-draft';
import { saleLineConfiguration } from '../transaction/model/sale-line-additions';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../cart/item-configurator';
import { AddTransactionItemDialog } from './transaction-item-dialog';
import type {
  CatalogItem,
  ComponentCandidate,
  Employee,
  Sale,
  SaleLine,
} from '../transaction/model/cashier-transaction.types';
import { hasSuccessfulPayment } from '../payment/sale-payment-status';
import { OrderAdjustmentFooter } from './order-adjustment-footer';
import { OrderAdjustmentLine } from './order-adjustment-line';
import { ItemCorrectionDialog } from './item-correction-dialog';
import { useItemCorrection } from './use-item-correction';
import { transactionNumber } from '../transaction/model/sale-display';

export function ReferenceOrderAdjustmentDialog({
  sale,
  items,
  locale,
  isMutating: mutating,
  onClose,
  onAdd,
  onQuantity,
  onRemove,
  onEdit,
  onCorrect,
  onPreview,
  loadConfiguratorState,
  loadCandidates,
  canAdjust,
  canRefundPayment,
  onCompensate,
  employees = [],
}: {
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
  onClose: () => void;
  /** Adds a new item, chosen and configured in the shared item configuration, as a new line. */
  onAdd: (item: CatalogItem, configuration: ItemConfiguration) => Promise<unknown>;
  onQuantity: (line: SaleLine, quantity: string) => void;
  onRemove: (line: SaleLine) => void;
  /** Ordinary edit of a line whose work has not started: same item, new configuration, no reason. */
  onEdit: (line: SaleLine, input: { lines: ReplaceSaleLineInput['lines'] }) => Promise<unknown>;
  /** One atomic correction with a full item configuration; it may become several Sale lines. */
  onCorrect: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => Promise<unknown>;
  /** Runtime-calculated impact of the same correction (same reason, same rules); nothing is saved. */
  onPreview: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => Promise<ReplaceLinePreview>;
  /** Everything the shared item configuration needs for one item at this location. */
  loadConfiguratorState: (item: CatalogItem) => Promise<ItemConfiguratorState>;
  loadCandidates: (q: string) => Promise<{ items: ComponentCandidate[] }>;
  /** Session may adjust this Sale in its current state (see `canAdjustOrder`). */
  canAdjust: boolean;
  canRefundPayment: boolean;
  onCompensate: (sale: Sale, paymentId: string, amount: string) => Promise<unknown>;
}) {
  const { copy } = useOperationalLocalization();
  // Without the adjustment permission every mutating control is off; closing stays available.
  const isMutating = mutating || !canAdjust;
  const [addOpen, setAddOpen] = useState(false);
  // Ordinary edit of a not-yet-started line, in the shared item configuration.
  const [editLine, setEditLine] = useState<SaleLine | null>(null);
  const [editState, setEditState] = useState<ItemConfiguratorState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  // Quantities when the dialog opened; only rows that differ show what changed.
  const [baseline] = useState<ReadonlyMap<string, string>>(
    () =>
      new Map(
        (sale?.lines ?? [])
          .filter((line) => line.removedAt === null)
          .map((line) => [line.id, line.quantity]),
      ),
  );
  const { correction, previewRef } = useItemCorrection({
    sale,
    items,
    locale,
    loadConfiguratorState,
    onPreview,
    onCorrect,
    onCompensate,
  });
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
    const line = editLine;
    const lines = replacementLinesOf(editState.item.id, configuration.catalogVariantId, {
      ...configuration,
      soldByEmployeeId: configuration.soldBy?.employeeId ?? null,
    });
    closeEdit();
    void onEdit(line, { lines }).catch((error: unknown) =>
      setEditError(
        correctionErrorMessage(
          error,
          copy('The item could not be changed. Reload the transaction and try again.'),
          locale,
        ),
      ),
    );
  };

  if (!sale) return null;

  const activeLines = sale.lines.filter((line) => line.removedAt === null);
  const removedCount = [...baseline.keys()].filter(
    (lineId) => !activeLines.some((line) => line.id === lineId),
  ).length;
  const changed =
    removedCount > 0 ||
    activeLines.some((line) => {
      const before = baseline.get(line.id);
      return before === undefined || !createDecimal(before).equals(createDecimal(line.quantity));
    });

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={copy('Adjust order')}
        description={transactionNumber(sale, locale)}
        ariaLabel={copy('Adjust order')}
        closeOnEscape
        closeOnOverlay
        className="pos-reference-dialog w-full max-w-xl overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
        footer={
          <OrderAdjustmentFooter
            sale={sale}
            locale={locale}
            changed={changed}
            mutating={mutating}
            onClose={onClose}
          />
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            {copy(
              hasSuccessfulPayment(sale)
                ? 'Each change is recorded right away. Items already paid stay on the payment record.'
                : 'Each change is recorded right away.',
            )}
          </p>
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {activeLines.map((line) => (
              <OrderAdjustmentLine
                key={line.id}
                sale={sale}
                line={line}
                addedInThisAdjustment={!baseline.has(line.id)}
                baselineQuantity={baseline.get(line.id)}
                sellable={items.some((item) => item.id === line.catalogItemId)}
                employees={employees}
                locale={locale}
                isMutating={isMutating}
                onQuantity={onQuantity}
                onRemove={onRemove}
                onEdit={openEdit}
                onStartCorrection={correction.start}
              />
            ))}
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
          canRefundPayment={canRefundPayment}
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
          onConfirm={onAdd}
          onClose={() => setAddOpen(false)}
        />
      ) : null}
    </>
  );
}
