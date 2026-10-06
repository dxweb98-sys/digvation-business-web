import { createDecimal } from '@digvation/pos-money';
import { DAlert, DButton as Button, DDialog as Dialog } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import { Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import {
  saleLineConfiguration,
  additionPerformedBy,
} from '../transaction/model/sale-line-additions';
import {
  ItemConfigurator,
  type ItemConfiguration,
  type ItemConfiguratorState,
} from '../cart/item-configurator';
import { AddTransactionItemDialog, CatalogItemAutocomplete } from './transaction-item-dialog';
import { correctionSourceOf, saleLineAdjustmentMode } from './sale-adjustment-access';
import { saleSettlement } from '../transaction/model/sale-presentation';
import type {
  CatalogItem,
  ComponentCandidate,
  Employee,
  Sale,
  SaleLine,
} from '../transaction/model/cashier-transaction.types';
import { hasSuccessfulPayment } from '../payment/sale-payment-status';
import { money, quantity, transactionNumber } from '../transaction/model/sale-display';

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
  const [correctionLine, setCorrectionLine] = useState<SaleLine | null>(null);
  const [replacementItemId, setReplacementItemId] = useState('');
  // The shared item configuration of the replacement: the same model as adding or editing an item.
  const [configuratorState, setConfiguratorState] = useState<ItemConfiguratorState | null>(null);
  const [configuratorLoading, setConfiguratorLoading] = useState(false);
  const [replacementConfiguration, setReplacementConfiguration] =
    useState<ItemConfiguration | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  // The Sale returned by the persisted correction/compensation is the settlement authority.
  const [appliedSale, setAppliedSale] = useState<Sale | null>(null);
  const [correctionSaved, setCorrectionSaved] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [compensationState, setCompensationState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [correctionPreview, setCorrectionPreview] = useState<ReplaceLinePreview | null>(null);
  const [previewState, setPreviewState] = useState<'IDLE' | 'LOADING' | 'ERROR'>('IDLE');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // Keep the authoritative result in view; it renders below the form.
    if (correctionPreview)
      previewRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [correctionPreview]);
  // Only the latest chosen replacement may fill the configuration.
  const replacementRequest = useRef(0);
  const loadReplacementState = (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    const ticket = ++replacementRequest.current;
    setConfiguratorState(null);
    setReplacementConfiguration(null);
    if (!item) return;
    setConfiguratorLoading(true);
    void loadConfiguratorState(item)
      .then((state) => {
        if (ticket === replacementRequest.current) setConfiguratorState(state);
      })
      .catch(() => undefined)
      .finally(() => {
        if (ticket === replacementRequest.current) setConfiguratorLoading(false);
      });
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
  // Both figures come from the Runtime-returned Sale after each command.
  const settlement = saleSettlement(sale);
  const paidAmount = createDecimal(settlement.totalPaid);
  const saleTotal = createDecimal(sale.totalAmount);
  const consequence = paidAmount.greaterThan(saleTotal)
    ? {
        label: copy('Refund'),
        amount: paidAmount.minus(saleTotal).toFixed(4),
        tone: 'text-[var(--color-warning)]',
      }
    : paidAmount.greaterThan(createDecimal('0')) && saleTotal.greaterThan(paidAmount)
      ? {
          label: copy('Additional payment'),
          amount: settlement.balanceDue,
          tone: 'text-[var(--color-brand)]',
        }
      : { label: copy('Total'), amount: sale.totalAmount, tone: 'text-[var(--color-text)]' };
  const correctionSource = correctionLine;
  const replacementLines = () =>
    replacementConfiguration && configuratorState
      ? replacementLinesOf(configuratorState.item.id, replacementConfiguration.catalogVariantId, {
          ...replacementConfiguration,
          // Carried explicitly so a correction never silently drops the salesperson.
          soldByEmployeeId: replacementConfiguration.soldBy?.employeeId ?? null,
        })
      : [];
  // Ready exactly when the shared configuration is valid: every unit satisfied, price resolved.
  const correctionReady = Boolean(configuratorState && replacementConfiguration);
  const previewCorrection = () => {
    if (!correctionSource || !correctionReady || !correctionReason.trim()) return;
    setPreviewState('LOADING');
    setPreviewError(null);
    void onPreview(correctionSource, { lines: replacementLines(), reason: correctionReason.trim() })
      .then((value) => {
        setCorrectionPreview(value);
        setPreviewState('IDLE');
      })
      .catch((error: unknown) => {
        setPreviewError(
          correctionErrorMessage(
            error,
            'Koreksi tidak dapat dipratinjau. Muat ulang transaksi lalu coba lagi.',
            locale,
          ),
        );
        setPreviewState('ERROR');
      });
  };
  const asSale = (value: unknown): Sale | null =>
    typeof value === 'object' && value !== null && 'payments' in value && 'totalAmount' in value
      ? (value as Sale)
      : null;
  const confirmCorrection = () => {
    if (!correctionSource) return;
    setCorrectionError(null);
    // Keep the flow open: whether money must now be returned depends on the persisted Sale.
    void onCorrect(correctionSource, { lines: replacementLines(), reason: correctionReason.trim() })
      .then((updated) => {
        setAppliedSale(asSale(updated));
        setCorrectionSaved(true);
      })
      .catch((error: unknown) =>
        setCorrectionError(
          correctionErrorMessage(
            error,
            'Koreksi belum dapat disimpan. Muat ulang transaksi lalu coba lagi.',
            locale,
          ),
        ),
      );
  };
  const authoritativeSale = appliedSale ?? sale;
  const authoritativeSettlement = saleSettlement(authoritativeSale);
  const settledPaid = createDecimal(authoritativeSettlement.totalPaid);
  const settledTotal = createDecimal(authoritativeSale.totalAmount);
  const settledOverpayment = settledPaid.greaterThan(settledTotal)
    ? settledPaid.minus(settledTotal)
    : createDecimal('0');
  const settledBalance = settledTotal.greaterThan(settledPaid)
    ? settledTotal.minus(settledPaid)
    : createDecimal('0');
  const settlementCashPayment = authoritativeSale.payments.find(
    (item) =>
      item.status === 'SUCCEEDED' &&
      item.method === 'CASH' &&
      createDecimal(item.appliedAmount).greaterThan(0),
  );
  const settlementProviderPayment = authoritativeSale.payments.find(
    (item) =>
      item.status === 'SUCCEEDED' &&
      item.method !== 'CASH' &&
      createDecimal(item.appliedAmount).greaterThan(0),
  );
  const compensateOverpayment = (paymentId: string) => {
    setCompensationState('LOADING');
    void onCompensate(authoritativeSale, paymentId, settledOverpayment.toFixed(4))
      .then((updated) => {
        setAppliedSale(asSale(updated) ?? appliedSale);
        setCompensationState('IDLE');
      })
      .catch(() => setCompensationState('ERROR'));
  };
  const figure = (label: string, value: string, className = '') => (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{money(value, locale)}</dd>
    </div>
  );
  const stepperClass =
    'flex size-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40';

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
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              <p className="text-[11px] text-[var(--color-text-muted)]">{consequence.label}</p>
              <p className={`text-base font-semibold tabular-nums ${consequence.tone}`}>
                {money(consequence.amount, locale)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {changed ? null : (
                <Button variant="ghost" onClick={onClose}>
                  {copy('Cancel')}
                </Button>
              )}
              <Button disabled={mutating} onClick={onClose}>
                {copy('Save adjustment')}
              </Button>
            </div>
          </div>
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
            {activeLines.map((line) => {
              // Runtime stays the authority; this only decides which controls are offered.
              const mode = saleLineAdjustmentMode(sale, line, {
                addedInThisAdjustment: !baseline.has(line.id),
              });
              const correctedFrom = correctionSourceOf(sale, line);
              const editable = mode === 'EDIT';
              const canDecrease =
                editable && createDecimal(line.quantity).greaterThan(createDecimal('1'));
              const sellable = items.some((item) => item.id === line.catalogItemId);
              const before = baseline.get(line.id);
              const lineChange =
                before === undefined
                  ? copy('New')
                  : createDecimal(before).equals(createDecimal(line.quantity))
                    ? null
                    : `${copy('Was')} ${quantity(before)}`;
              return (
                <li
                  key={line.id}
                  data-adjustment-mode={mode}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2"
                >
                  <div className="min-w-0 flex-1 basis-40">
                    <p
                      className="truncate text-sm"
                      title={`${line.itemNameSnapshot}${line.variantNameSnapshot ? ` · ${line.variantNameSnapshot}` : ''}`}
                    >
                      <span className="font-semibold">{line.itemNameSnapshot}</span>
                      {line.variantNameSnapshot ? (
                        <span className="text-[var(--color-text-muted)]">
                          {' '}
                          · {line.variantNameSnapshot}
                        </span>
                      ) : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-[var(--color-text-muted)]">
                      {money(line.effectiveUnitPrice, locale)}
                      {lineChange ? (
                        <span className="rounded-full bg-[var(--color-brand)]/10 px-1.5 text-[10px] font-semibold text-[var(--color-brand)]">
                          {lineChange}
                        </span>
                      ) : null}
                    </p>
                    {line.soldByEmployeeNameSnapshot ? (
                      // The Product salesperson; Service performers are a separate concept.
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {copy('Sold by')} {line.soldByEmployeeNameSnapshot}
                      </p>
                    ) : null}
                    {(line.compositionComponents ?? [])
                      .filter(
                        (component) =>
                          component.componentSource === 'SALE_SELECTED' &&
                          component.performers?.length,
                      )
                      .map((component) => (
                        // Part of this Service's work, never a Product sale of its own.
                        <p
                          key={component.id}
                          className="text-[11px] text-[var(--color-text-muted)]"
                        >
                          +{' '}
                          {[component.itemNameSnapshot, component.variantNameSnapshot]
                            .filter(Boolean)
                            .join(' / ')}{' '}
                          ·{' '}
                          {additionPerformedBy(
                            {
                              performerIds: component.performers!.map(
                                (performer) => performer.employeeId,
                              ),
                            },
                            employees,
                            copy,
                          )}
                        </p>
                      ))}
                    {correctedFrom ? (
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Koreksi dari {correctedFrom.itemNameSnapshot}
                        {correctedFrom.fulfillment ? ' · pekerjaan awal tetap tercatat' : ''}
                      </p>
                    ) : null}
                    {mode === 'LOCKED' ? (
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Item yang sudah selesai dikerjakan tidak dapat dikoreksi.
                      </p>
                    ) : null}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    {editable ? (
                      <>
                        <button
                          type="button"
                          aria-label={`${copy('Decrease quantity')} ${line.itemNameSnapshot}`}
                          disabled={!canDecrease || isMutating}
                          onClick={() =>
                            onQuantity(
                              line,
                              createDecimal(line.quantity).minus(createDecimal('1')).toFixed(4),
                            )
                          }
                          className={stepperClass}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold tabular-nums">
                          {quantity(line.quantity)}
                        </span>
                        <button
                          type="button"
                          aria-label={`${copy('Increase quantity')} ${line.itemNameSnapshot}`}
                          disabled={isMutating}
                          onClick={() =>
                            onQuantity(
                              line,
                              createDecimal(line.quantity).plus(createDecimal('1')).toFixed(4),
                            )
                          }
                          className={stepperClass}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        {sale.status === 'OPEN' ? (
                          <button
                            type="button"
                            aria-label={`${copy('Edit item')} ${line.itemNameSnapshot}`}
                            title={copy('Edit item')}
                            // Same item, new configuration; an item no longer sold is removed instead.
                            disabled={isMutating || !sellable}
                            onClick={() => openEdit(line)}
                            className={stepperClass}
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={`${copy('Remove')} ${line.itemNameSnapshot}`}
                          disabled={isMutating}
                          onClick={() => onRemove(line)}
                          className="ml-0.5 flex size-8 items-center justify-center rounded-lg text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      // Once work is in progress the quantity, removal and configuration of an
                      // existing line change only through the audited correction, never directly.
                      <span className="px-1 text-xs font-semibold tabular-nums text-[var(--color-text-muted)]">
                        × {quantity(line.quantity)}
                      </span>
                    )}
                    {mode === 'CORRECTION' && sale.status === 'OPEN' ? (
                      <button
                        type="button"
                        aria-label={`Koreksi item ${line.itemNameSnapshot}`}
                        disabled={isMutating}
                        onClick={() => {
                          setCorrectionLine(line);
                          // The current item starts selected and configured exactly as the line, so a
                          // variant or quantity correction needs no search. Choosing another item in
                          // the field changes the Catalog item and starts a fresh configuration.
                          const current = items.some((item) => item.id === line.catalogItemId)
                            ? line.catalogItemId
                            : '';
                          setReplacementItemId(current);
                          loadReplacementState(current);
                          setAppliedSale(null);
                          setCorrectionSaved(false);
                          setCorrectionError(null);
                          setPreviewError(null);
                          setCompensationState('IDLE');
                          setCorrectionReason('');
                          setCorrectionPreview(null);
                          setPreviewState('IDLE');
                        }}
                        className="ml-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 disabled:opacity-40"
                      >
                        Koreksi item
                      </button>
                    ) : null}
                  </div>
                </li>
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
        </div>
      </Dialog>
      {correctionLine ? (
        <Dialog
          open
          onClose={() => setCorrectionLine(null)}
          title="Koreksi item"
          description={transactionNumber(sale, locale)}
          ariaLabel="Koreksi item"
          closeOnOverlay={false}
          className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
          footer={
            correctionSaved ? (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button onClick={() => setCorrectionLine(null)}>Selesai</Button>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                <Button
                  variant="ghost"
                  className="sm:mr-auto"
                  onClick={() => setCorrectionLine(null)}
                >
                  Kembali
                </Button>
                <Button
                  variant="outline"
                  disabled={!correctionReady || !correctionReason.trim() || isMutating}
                  loading={previewState === 'LOADING'}
                  onClick={previewCorrection}
                >
                  Lihat dampak
                </Button>
                <Button
                  disabled={!correctionPreview || !correctionReason.trim() || isMutating}
                  loading={isMutating}
                  onClick={confirmCorrection}
                >
                  Konfirmasi koreksi
                </Button>
              </div>
            )
          }
        >
          {correctionSaved ? (
            <div className="space-y-4" aria-live="polite">
              <DAlert variant="success">Koreksi tersimpan.</DAlert>
              <section
                aria-label="Penyelesaian pembayaran"
                className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm"
              >
                <dl className="space-y-1.5 text-[var(--color-text-muted)]">
                  {figure(
                    'Total transaksi',
                    authoritativeSale.totalAmount,
                    'font-semibold text-[var(--color-text)]',
                  )}
                  {figure('Sudah dibayar', settledPaid.toFixed(4))}
                </dl>
                <div className="mt-2 space-y-1.5 border-t border-[var(--color-border)] pt-2">
                  {settledOverpayment.greaterThan(createDecimal('0')) ? (
                    <>
                      <dl>
                        {figure(
                          'Kelebihan pembayaran',
                          settledOverpayment.toFixed(4),
                          'font-semibold text-[var(--color-danger)]',
                        )}
                      </dl>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Transaksi belum dapat diselesaikan sampai kelebihan pembayaran dikembalikan.
                      </p>
                      {settlementCashPayment ? (
                        canRefundPayment ? (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={compensationState === 'LOADING'}
                            disabled={isMutating}
                            onClick={() => compensateOverpayment(settlementCashPayment.id)}
                          >
                            Kembalikan kelebihan pembayaran
                          </Button>
                        ) : (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Pengembalian dana memerlukan pengguna dengan izin pengembalian
                            pembayaran.
                          </p>
                        )
                      ) : settlementProviderPayment ? (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Pengembalian pembayaran ini memerlukan konfirmasi dari penyedia
                          pembayaran.
                        </p>
                      ) : null}
                      {compensationState === 'ERROR' ? (
                        <DAlert variant="danger">
                          Pengembalian kelebihan pembayaran belum dapat diselesaikan. Muat ulang
                          transaksi lalu coba lagi.
                        </DAlert>
                      ) : null}
                    </>
                  ) : settledBalance.greaterThan(createDecimal('0')) ? (
                    <dl>
                      {figure(
                        'Sisa pembayaran',
                        settledBalance.toFixed(4),
                        'font-semibold text-[var(--color-text)]',
                      )}
                    </dl>
                  ) : (
                    <p className="font-semibold text-[var(--color-text)]">
                      Pembayaran sudah sesuai
                    </p>
                  )}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Item saat ini</p>
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {correctionLine.itemNameSnapshot}
                  </p>
                  <p className="text-xs tabular-nums text-[var(--color-text-muted)]">
                    {quantity(correctionLine.quantity)} ×{' '}
                    {money(correctionLine.effectiveUnitPrice, locale)}
                  </p>
                  {correctionLine.fulfillment?.status === 'IN_PROGRESS' ? (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Pekerjaan yang sudah berjalan tetap tercatat pada item ini.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
                <CatalogItemAutocomplete
                  label="Item koreksi"
                  ariaLabel="Item koreksi"
                  items={items}
                  value={replacementItemId || null}
                  locale={locale}
                  disabled={isMutating}
                  onChange={(item) => {
                    // The same item keeps its configuration; a different item starts fresh.
                    if ((item?.id ?? '') === replacementItemId) return;
                    setReplacementItemId(item?.id ?? '');
                    setCorrectionPreview(null);
                    setPreviewError(null);
                    loadReplacementState(item?.id ?? '');
                  }}
                />
                {configuratorState ? (
                  <ItemConfigurator
                    // A different item starts a fresh configuration; the same item starts from the line.
                    key={configuratorState.item.id}
                    presentation="inline"
                    {...configuratorState}
                    loadCandidates={loadCandidates}
                    {...(correctionSource &&
                    correctionSource.catalogItemId === configuratorState.item.id
                      ? {
                          initial: {
                            ...saleLineConfiguration(correctionSource, employees),
                          },
                        }
                      : {})}
                    onConfigurationChange={(configuration) => {
                      setReplacementConfiguration(configuration);
                      setCorrectionPreview(null);
                      setPreviewError(null);
                    }}
                  />
                ) : configuratorLoading ? (
                  <p className="text-sm text-[var(--color-text-muted)]">Memuat konfigurasi item…</p>
                ) : null}
                <DTextarea
                  label="Alasan koreksi"
                  rows={3}
                  value={correctionReason}
                  placeholder="Contoh: Salah memilih layanan"
                  onChange={setCorrectionReason}
                />
              </div>
              {previewState === 'ERROR' && previewError ? (
                <DAlert variant="danger">{previewError}</DAlert>
              ) : null}
              {correctionError ? <DAlert variant="danger">{correctionError}</DAlert> : null}
              {correctionPreview ? (
                <section
                  ref={previewRef}
                  aria-label="Dampak koreksi"
                  aria-live="polite"
                  className="rounded-xl bg-[var(--color-surface-muted)] p-3 text-sm"
                >
                  <ul
                    aria-label="Hasil koreksi"
                    className="mb-3 space-y-2 border-b border-[var(--color-border)] pb-3"
                  >
                    {correctionPreview.replacements.map((replacement, index) => (
                      <li key={`${replacement.catalogItemId}-${index}`} className="text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 font-semibold text-[var(--color-text)]">
                            {replacement.itemName}
                            {replacement.variantName ? ` · ${replacement.variantName}` : ''}
                            <span className="block font-normal tabular-nums text-[var(--color-text-muted)]">
                              {quantity(replacement.quantity)} ×{' '}
                              {money(replacement.unitAmount, locale)}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {money(replacement.grossAmount, locale)}
                          </span>
                        </div>
                        {replacement.additions.map((addition) => (
                          <p
                            key={addition.name}
                            className="mt-0.5 pl-3 text-[var(--color-text-muted)]"
                          >
                            + {addition.name} × {quantity(addition.quantity)} ·{' '}
                            {money(addition.amount, locale)}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                  <dl className="space-y-1.5 text-[var(--color-text-muted)]">
                    {figure('Total sebelumnya', correctionPreview.currentTotalAmount)}
                    {figure(
                      'Total setelah koreksi',
                      correctionPreview.correctedTotalAmount,
                      'font-semibold text-[var(--color-text)]',
                    )}
                    {figure('Sudah dibayar', correctionPreview.netSuccessfulPaidAmount)}
                  </dl>
                  <div className="mt-2 space-y-1.5 border-t border-[var(--color-border)] pt-2">
                    {/* Runtime's consequence: what remains to pay, or what is returned as a new refund. */}
                    {correctionPreview.refundAmount &&
                    createDecimal(correctionPreview.refundAmount).greaterThan(
                      createDecimal('0'),
                    ) ? (
                      <dl>
                        {figure(
                          'Dikembalikan ke pelanggan',
                          correctionPreview.refundAmount,
                          'font-semibold text-[var(--color-warning)]',
                        )}
                      </dl>
                    ) : (
                      <dl>
                        {figure(
                          'Sisa pembayaran',
                          correctionPreview.remainingPaymentAmount,
                          'font-semibold text-[var(--color-text)]',
                        )}
                      </dl>
                    )}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </Dialog>
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
