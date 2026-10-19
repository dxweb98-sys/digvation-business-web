import { DBadge } from '@digvation/ui';
import { Percent, ReceiptText } from 'lucide-react';
import { useState } from 'react';

import {
  RecordInfoTile,
  RecordPanel,
  RecordPanelBody,
  RecordPanelHeader,
} from '../../../shared/ui/record-dialog';
import type { BusinessSettingsApi, BusinessTaxConfiguration } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { percentageFromTaxRate } from '../model/business-tax-rate';
import { SectionEditButton, TilesSkeleton } from './business-section-layout';
import { BusinessTaxDialog } from './business-tax-dialog';

export function BusinessTaxSection({
  tax,
  loading,
  canUpdate,
  api,
  onChanged,
}: {
  tax?: BusinessTaxConfiguration | undefined;
  loading: boolean;
  canUpdate: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const [open, setOpen] = useState(false);

  return (
    <RecordPanel padded={false} ariaLabel={copy('Business tax')}>
      <RecordPanelHeader
        title={copy('Business tax')}
        trailing={
          canUpdate && tax ? (
            <SectionEditButton label={copy('Edit tax')} onClick={() => setOpen(true)} />
          ) : null
        }
      />
      <RecordPanelBody>
        <p className="text-sm text-(--color-text-muted)">
          {copy(
            'Applied to new transaction totals. Finalized transactions keep the tax they recorded.',
          )}
        </p>
        {loading ? (
          <TilesSkeleton count={2} />
        ) : tax ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={copy('Tax status')}
              icon={<ReceiptText className="size-3.5" aria-hidden="true" />}
              value={
                <DBadge variant={tax.enabled ? 'success' : 'secondary'}>
                  {copy(tax.enabled ? 'Active' : 'Inactive')}
                </DBadge>
              }
            />
            <RecordInfoTile
              label={copy('Tax rate')}
              icon={<Percent className="size-3.5" aria-hidden="true" />}
              value={<span className="tabular-nums">{percentageFromTaxRate(tax.rate)}%</span>}
            />
          </div>
        ) : null}
      </RecordPanelBody>
      {open && tax ? (
        <BusinessTaxDialog tax={tax} api={api} onClose={() => setOpen(false)} onSaved={onChanged} />
      ) : null}
    </RecordPanel>
  );
}
