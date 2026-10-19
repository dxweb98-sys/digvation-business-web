import { DDataTable, useToast, type TableColumn } from '@digvation/ui';
import { Pencil } from 'lucide-react';
import { useState } from 'react';

import type { BusinessSettingsApi, NumberingPreference } from '../api/business-settings-api';
import { useBusinessLocalization } from '../localization/use-business-localization';
import { NAMESPACE_LABELS } from '../model/business-numbering';
import { BusinessNumberingDialog } from './business-numbering-dialog';
import { BusinessListHeading } from './business-section-layout';

export function BusinessNumberingSection({
  preferences,
  loading,
  canUpdate,
  invoiceApplicable,
  api,
  onChanged,
}: {
  preferences: NumberingPreference[];
  loading: boolean;
  canUpdate: boolean;
  invoiceApplicable: boolean;
  api: BusinessSettingsApi;
  onChanged: () => void;
}) {
  const { copy } = useBusinessLocalization();
  const { showToast } = useToast();
  const [editing, setEditing] = useState<NumberingPreference | null>(null);
  const visible = preferences.filter((item) => item.namespace !== 'INVOICE' || invoiceApplicable);

  const columns: TableColumn<NumberingPreference>[] = [
    {
      key: 'namespace',
      label: copy('Record type'),
      render: (item) => (
        <span className="font-medium text-(--color-text)">
          {copy(NAMESPACE_LABELS[item.namespace])}
        </span>
      ),
    },
    {
      key: 'prefix',
      label: copy('Prefix'),
      render: (item) => <span className="font-mono text-sm">{item.prefix}</span>,
    },
    {
      key: 'padding',
      label: copy('Padding'),
      align: 'right',
      render: (item) => <span className="tabular-nums">{item.padding}</span>,
    },
    {
      key: 'currentSequence',
      label: copy('Current sequence'),
      align: 'right',
      render: (item) => <span className="font-mono tabular-nums">{item.currentSequence}</span>,
    },
  ];

  return (
    <section aria-label={copy('Automatic numbering')} className="space-y-3">
      <BusinessListHeading
        title={copy('Automatic numbering')}
        description={copy(
          'Used when a code is left empty. Changes apply to future codes only; existing codes and the current number never change.',
        )}
      />
      <DDataTable
        columns={columns}
        data={visible}
        loading={loading}
        rowKey="namespace"
        emptyMessage={copy('No automatic numbering is applicable to the enabled features.')}
        actions={
          canUpdate
            ? [
                {
                  label: copy('Edit numbering'),
                  icon: <Pencil className="size-4" />,
                  onClick: (item) => setEditing(item),
                },
              ]
            : []
        }
      />
      {editing ? (
        <BusinessNumberingDialog
          key={editing.namespace}
          preference={editing}
          label={copy(NAMESPACE_LABELS[editing.namespace])}
          api={api}
          onClose={() => setEditing(null)}
          onChanged={() => {
            onChanged();
            showToast({ variant: 'success', title: copy('Numbering updated.') });
          }}
        />
      ) : null}
    </section>
  );
}
