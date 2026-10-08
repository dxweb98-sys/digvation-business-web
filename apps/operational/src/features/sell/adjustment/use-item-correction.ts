import { useEffect, useRef, useState } from 'react';

import { replacementLinesOf } from '../cart/cart-draft';
import type { ItemConfiguration, ItemConfiguratorState } from '../cart/item-configurator';
import { correctionErrorMessage } from '../transaction/api/cashier-transaction-errors';
import type {
  ReplaceLinePreview,
  ReplaceSaleLineInput,
} from '../transaction/api/cashier-transaction.adapter';
import type { CatalogItem, SaleLine } from '../transaction/model/cashier-transaction.types';

/**
 * The audited correction of one Sale line whose work has started, as part of the adjustment
 * draft: choosing and configuring the replacement, its reason, and Runtime's impact of the draft
 * with it. Confirming only proposes the correction; it is saved with the rest of the adjustment.
 */
export function useItemCorrection({
  items,
  locale,
  loadConfiguratorState,
  onPreview,
  onConfirm,
}: {
  items: readonly CatalogItem[];
  locale: string;
  loadConfiguratorState: (item: CatalogItem) => Promise<ItemConfiguratorState>;
  /** Runtime's impact of the draft with this correction in it; nothing is saved. */
  onPreview: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => Promise<ReplaceLinePreview>;
  /** Adds the confirmed correction to the adjustment draft. */
  onConfirm: (
    line: SaleLine,
    input: { lines: ReplaceSaleLineInput['lines']; reason: string },
  ) => void;
}) {
  const [correctionLine, setCorrectionLine] = useState<SaleLine | null>(null);
  const [replacementItemId, setReplacementItemId] = useState('');
  // The shared item configuration of the replacement: the same model as adding or editing an item.
  const [configuratorState, setConfiguratorState] = useState<ItemConfiguratorState | null>(null);
  const [configuratorLoading, setConfiguratorLoading] = useState(false);
  const [replacementConfiguration, setReplacementConfiguration] =
    useState<ItemConfiguration | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
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
    setPreviewError(null);
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
    if (!correctionSource || !correctionPreview) return;
    onConfirm(correctionSource, { lines: replacementLines(), reason: correctionReason.trim() });
    close();
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
      confirm: confirmCorrection,
    },
  };
}

export type ItemCorrection = ReturnType<typeof useItemCorrection>['correction'];
