import { useEffect, useRef, useState } from 'react';

import { replacementLinesOf } from '../cart/cart-draft';
import type { ItemConfiguration, ItemConfiguratorState } from '../cart/item-configurator';
import { correctionErrorMessage } from '../transaction/api/cashier-transaction-errors';
import type {
  ReplaceLinePreview,
  ReplaceSaleLineInput,
} from '../transaction/api/cashier-transaction.adapter';
import type { CatalogItem, Sale, SaleLine } from '../transaction/model/cashier-transaction.types';
import { correctionSettlement } from './item-correction-settlement';

const asSale = (value: unknown): Sale | null =>
  typeof value === 'object' && value !== null && 'payments' in value && 'totalAmount' in value
    ? (value as Sale)
    : null;

/**
 * The audited correction of one Sale line whose work has started: choosing and configuring the
 * replacement, its reason, Runtime's impact preview, the persisted correction, and returning any
 * overpayment the persisted Sale shows.
 */
export function useItemCorrection({
  sale,
  items,
  locale,
  loadConfiguratorState,
  onPreview,
  onCorrect,
  onCompensate,
}: {
  sale: Sale | null;
  items: readonly CatalogItem[];
  locale: string;
  loadConfiguratorState: (item: CatalogItem) => Promise<ItemConfiguratorState>;
  onPreview: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => Promise<ReplaceLinePreview>;
  onCorrect: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => Promise<unknown>;
  onCompensate: (sale: Sale, paymentId: string, amount: string) => Promise<unknown>;
}) {
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
  const start = (line: SaleLine) => {
    setCorrectionLine(line);
    // The current item starts selected and configured exactly as the line, so a
    // variant or quantity correction needs no search. Choosing another item in
    // the field changes the Catalog item and starts a fresh configuration.
    const current = items.some((item) => item.id === line.catalogItemId) ? line.catalogItemId : '';
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
  };
  const close = () => setCorrectionLine(null);
  const changeReplacementItem = (item: CatalogItem | null) => {
    // The same item keeps its configuration; a different item starts fresh.
    if ((item?.id ?? '') === replacementItemId) return;
    setReplacementItemId(item?.id ?? '');
    setCorrectionPreview(null);
    setPreviewError(null);
    loadReplacementState(item?.id ?? '');
  };
  const changeConfiguration = (configuration: ItemConfiguration | null) => {
    setReplacementConfiguration(configuration);
    setCorrectionPreview(null);
    setPreviewError(null);
  };
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
  const compensateOverpayment = (paymentId: string) => {
    // Offered only from a shown correction, which always has a Sale.
    if (!authoritativeSale) return;
    const { settledOverpayment } = correctionSettlement(authoritativeSale);
    setCompensationState('LOADING');
    void onCompensate(authoritativeSale, paymentId, settledOverpayment.toFixed(4))
      .then((updated) => {
        setAppliedSale(asSale(updated) ?? appliedSale);
        setCompensationState('IDLE');
      })
      .catch(() => setCompensationState('ERROR'));
  };
  return {
    // The preview's element, kept apart from the correction state that renders it.
    previewRef,
    correction: {
      line: correctionLine,
      start,
      close,
      replacementItemId,
      changeReplacementItem,
      configuratorState,
      configuratorLoading,
      changeConfiguration,
      reason: correctionReason,
      setReason: setCorrectionReason,
      ready: correctionReady,
      preview: correctionPreview,
      previewState,
      previewError,
      runPreview: previewCorrection,
      error: correctionError,
      confirm: confirmCorrection,
      saved: correctionSaved,
      authoritativeSale,
      compensationState,
      compensate: compensateOverpayment,
    },
  };
}

export type ItemCorrection = ReturnType<typeof useItemCorrection>['correction'];
