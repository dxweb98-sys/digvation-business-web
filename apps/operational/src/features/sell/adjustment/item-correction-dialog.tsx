import { DAlert, DButton as Button, DDialog as Dialog } from '@digvation-labs/ui';
import { DTextarea } from '@digvation/ui';
import type { RefObject } from 'react';

import { ItemConfigurator } from '../cart/item-configurator';
import type {
  CatalogItem,
  ComponentCandidate,
  Employee,
  Sale,
  SaleLine,
} from '../transaction/model/cashier-transaction.types';
import { money, quantity, transactionNumber } from '../transaction/model/sale-display';
import { saleLineConfiguration } from '../transaction/model/sale-line-additions';
import { CorrectionImpactPreview } from './item-correction-impact';
import { CatalogItemAutocomplete } from './transaction-item-dialog';
import type { ItemCorrection } from './use-item-correction';

/**
 * Correcting one line whose work has started: the replacement and its reason, and Runtime's impact
 * of the adjustment with it. Confirming adds the correction to the adjustment draft; nothing is
 * saved until the whole adjustment is.
 */
export function ItemCorrectionDialog({
  correction,
  previewRef,
  line,
  sale,
  items,
  employees,
  locale,
  isMutating,
  loadCandidates,
}: {
  correction: ItemCorrection;
  /** Where Runtime's impact renders, so it is scrolled into view once shown. */
  previewRef: RefObject<HTMLElement | null>;
  /** The line being corrected. */
  line: SaleLine;
  sale: Sale;
  items: readonly CatalogItem[];
  employees: readonly Employee[];
  locale: string;
  isMutating: boolean;
  loadCandidates: (q: string) => Promise<{ items: ComponentCandidate[] }>;
}) {
  return (
    <Dialog
      open
      onClose={correction.close}
      title="Koreksi item"
      description={transactionNumber(sale, locale)}
      ariaLabel="Koreksi item"
      closeOnOverlay={false}
      className="pos-reference-dialog w-full max-w-lg overflow-hidden rounded-t-2xl bg-[var(--color-surface)] shadow-xl sm:rounded-xl"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <Button variant="ghost" className="sm:mr-auto" onClick={correction.close}>
            Kembali
          </Button>
          <Button
            variant="outline"
            disabled={!correction.ready || !correction.reason.trim() || isMutating}
            loading={correction.previewState === 'LOADING'}
            onClick={correction.runPreview}
          >
            Lihat dampak
          </Button>
          <Button
            disabled={!correction.preview || !correction.reason.trim() || isMutating}
            onClick={correction.confirm}
          >
            Konfirmasi koreksi
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs text-[var(--color-text-muted)]">Item saat ini</p>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {line.itemNameSnapshot}
            </p>
            <p className="text-xs tabular-nums text-[var(--color-text-muted)]">
              {quantity(line.quantity)} × {money(line.effectiveUnitPrice, locale)}
            </p>
            {line.fulfillment?.status === 'IN_PROGRESS' ? (
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
            value={correction.replacementItemId || null}
            locale={locale}
            disabled={isMutating}
            onChange={correction.changeReplacementItem}
          />
          {correction.configuratorState ? (
            <ItemConfigurator
              // A different item starts a fresh configuration; the same item starts from the line.
              key={correction.configuratorState.item.id}
              presentation="inline"
              {...correction.configuratorState}
              loadCandidates={loadCandidates}
              {...(line.catalogItemId === correction.configuratorState.item.id
                ? {
                    initial: {
                      ...saleLineConfiguration(line, employees),
                    },
                  }
                : {})}
              onConfigurationChange={correction.changeConfiguration}
            />
          ) : correction.configuratorLoading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Memuat konfigurasi item…</p>
          ) : null}
          <DTextarea
            label="Alasan koreksi"
            rows={3}
            value={correction.reason}
            placeholder="Contoh: Salah memilih layanan"
            onChange={correction.setReason}
          />
        </div>
        {correction.previewState === 'ERROR' && correction.previewError ? (
          <DAlert variant="danger">{correction.previewError}</DAlert>
        ) : null}
        {correction.preview ? (
          <CorrectionImpactPreview ref={previewRef} preview={correction.preview} locale={locale} />
        ) : null}
      </div>
    </Dialog>
  );
}
