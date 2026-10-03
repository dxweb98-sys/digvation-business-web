import type { AuthSession } from '@digvation/business-auth';
import { DButton, DDropdown, DInput, DRangeDatePicker, DSelect, useToast } from '@digvation/ui';
import { useQueries } from '@tanstack/react-query';
import { Download } from 'lucide-react';

import { RecordPanel, RecordPanelBody, RecordPanelHeader } from '../../../shared/ui/record-dialog';
import type {
  ExportFormat,
  OperationalLocationContext,
  ReferenceOption,
  ReferenceSource,
  ReportingApi,
  ReportQuery,
} from '../api/reporting-api';
import { useReportingLocalization } from '../localization/use-reporting-localization';
import type { ReportType } from '../model/report-availability';
import { ENUM_LABELS, type ReportDefinition } from '../model/report-catalog';
import { enumLabel } from '../model/report-format';

export interface ReportControlState {
  type: ReportType;
  dateFrom: string;
  dateTo: string;
  locationId: string;
  search: string;
  filters: Record<string, string>;
}

/** Reference lists are loaded only when the active report filters on them and the reader may read them. */
const REFERENCE_PERMISSION: Record<ReferenceSource, readonly string[]> = {
  employees: ['employees:read'],
  positions: ['employees:read'],
  catalogItems: ['catalog:read', 'tax:read'],
  categories: ['catalog:read', 'tax:read'],
  accounts: ['financial-accounts:read'],
};

const optionLabel = (option: ReferenceOption) =>
  option.name ?? option.displayName ?? option.code ?? option.id;

export function ReportControls({
  api,
  session,
  definition,
  available,
  state,
  locationContext,
  exportQuery,
  total,
  onChange,
  onTypeChange,
  onReset,
}: {
  api: ReportingApi;
  session: AuthSession | null;
  definition: ReportDefinition;
  available: readonly ReportDefinition[];
  state: ReportControlState;
  locationContext: OperationalLocationContext | undefined;
  exportQuery: ReportQuery;
  total: number | undefined;
  onChange: (change: Partial<ReportControlState>) => void;
  onTypeChange: (type: ReportType) => void;
  onReset: () => void;
}) {
  const { copy, locale } = useReportingLocalization();
  const { showToast } = useToast();
  const permissions = session?.access.permissions ?? [];
  const sources = [
    ...new Set(
      definition.filters.flatMap((filter) =>
        'reference' in filter &&
        REFERENCE_PERMISSION[filter.reference].some((permission) =>
          permissions.includes(permission),
        )
          ? [filter.reference]
          : [],
      ),
    ),
  ];
  const references = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['reporting-reference', source],
      queryFn: () => api.references(source),
      staleTime: 60_000,
    })),
  });
  const referenceOptions = (source: ReferenceSource) =>
    references[sources.indexOf(source)]?.data?.items ?? [];

  const setFilter = (key: string, value: string) => {
    const filters = { ...state.filters };
    if (value) filters[key] = value;
    else delete filters[key];
    onChange({ filters });
  };
  const download = async (format: ExportFormat) => {
    try {
      // The Runtime presents the file in the active Backoffice language.
      const url = URL.createObjectURL(
        await api.export(definition.type, format, exportQuery, locale),
      );
      const slug = copy(definition.label)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}_${state.dateFrom}_${state.dateTo}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast({
        variant: 'danger',
        title: copy(
          error instanceof Error && error.message === 'REPORT_EXPORT_TOO_LARGE'
            ? 'This export has too many records. Narrow the period or filters.'
            : 'Could not export this report.',
        ),
      });
    }
  };
  const activeCount = Object.keys(state.filters).length + (state.search.trim() ? 1 : 0);

  return (
    <RecordPanel padded={false} ariaLabel={copy('Report & period')}>
      <RecordPanelHeader
        title={copy('Report & period')}
        trailing={
          <DDropdown
            placement="bottom-end"
            contentRole="menu"
            closeOnItemClick
            trigger={() => (
              <DButton
                variant="secondary"
                size="sm"
                leftIcon={<Download aria-hidden="true" className="size-4" />}
              >
                {copy('Export')}
              </DButton>
            )}
          >
            {(['xlsx', 'csv'] as const).map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
                onClick={() => void download(format)}
              >
                {copy(format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV (.csv)')}
              </button>
            ))}
          </DDropdown>
        }
      />
      <RecordPanelBody>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          <DSelect
            label={copy('Report type')}
            value={definition.type}
            options={available.map((report) => ({ value: report.type, label: copy(report.label) }))}
            onChange={(value) => value && onTypeChange(value as ReportType)}
          />
          {/* A date range reads in full only with room for both dates. */}
          <div className="min-w-0 xl:col-span-2">
            <DRangeDatePicker
              label={copy('Period')}
              value={{ start: state.dateFrom, end: state.dateTo }}
              onChange={(range) =>
                onChange({
                  dateFrom: range.start ?? state.dateFrom,
                  dateTo: range.end ?? range.start ?? state.dateTo,
                })
              }
            />
          </div>
          {definition.locationScoped ? (
            <DSelect
              label={copy('Location')}
              value={state.locationId}
              options={[
                {
                  value: '',
                  label: copy(
                    locationContext?.organizationWide ? 'All locations' : 'Select location',
                  ),
                },
                ...(locationContext?.locations ?? []).map((location) => ({
                  value: location.id,
                  label: location.name,
                })),
              ]}
              onChange={(value) => onChange({ locationId: String(value ?? '') })}
            />
          ) : null}
          {definition.search ? (
            <DInput
              label={copy(definition.search.label)}
              value={state.search}
              onChange={(search) => onChange({ search })}
            />
          ) : null}
          {definition.filters.map((filter) => {
            const options =
              'enum' in filter
                ? Object.keys(ENUM_LABELS[filter.enum]).map((value) => ({
                    value,
                    label: enumLabel(filter.enum, value, copy),
                  }))
                : referenceOptions(filter.reference).map((option) => ({
                    value: option.id,
                    label: optionLabel(option),
                  }));
            if ('reference' in filter && !sources.includes(filter.reference)) return null;
            return (
              <DSelect
                key={filter.key}
                label={copy(filter.label)}
                value={state.filters[filter.key] ?? ''}
                options={[{ value: '', label: copy('All') }, ...options]}
                onChange={(value) => setFilter(filter.key, String(value ?? ''))}
              />
            );
          })}
        </div>
        {total !== undefined || activeCount ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
            <p className="text-xs tabular-nums text-[var(--color-text-muted)]">
              {total === undefined ? null : `${total} ${copy('records')}`}
            </p>
            {activeCount ? (
              <DButton variant="secondary" size="sm" onClick={onReset}>
                {copy('Reset filters')}
              </DButton>
            ) : null}
          </div>
        ) : null}
      </RecordPanelBody>
    </RecordPanel>
  );
}
