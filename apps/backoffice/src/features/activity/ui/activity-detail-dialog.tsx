import { DBadge, DButton, DDialog } from '@digvation/ui';
import { ChevronDown, MapPin, MonitorSmartphone, Target, UserRound } from 'lucide-react';

import {
  activityCategoryLabel,
  humanReadableLabel,
} from '../../../app/localization/human-readable-labels';
import {
  RecordDialogTitle,
  RecordInfoTile,
  RecordPanel,
  RecordSectionLabel,
} from '../../../shared/ui/record-dialog';
import type { ActivityEvent } from '../api/activity-api';
import { useActivityLocalization } from '../localization/use-activity-localization';
import {
  actionLabel,
  actorContext,
  outcomeVariant,
  sourceLabel,
  targetSummary,
} from '../model/activity-presentation';

/**
 * One recorded event, read-only: what happened and its outcome first, then who, on what, where and
 * from which application. Request and event identifiers are kept apart as technical information.
 */
export function ActivityDetailDialog({
  item,
  onClose,
}: {
  item: ActivityEvent | null;
  onClose: () => void;
}) {
  const { text, formatDateTime, locale } = useActivityLocalization();
  return (
    <DDialog
      open={Boolean(item)}
      onClose={onClose}
      size="lg"
      ariaLabel={text.activityDetails}
      title={
        <RecordDialogTitle title={text.activityDetails}>
          {item ? (
            <DBadge variant={outcomeVariant(item.outcome)}>
              {humanReadableLabel(item.outcome, locale)}
            </DBadge>
          ) : null}
        </RecordDialogTitle>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--color-text-muted)]">{text.readOnly}</p>
          <DButton variant="secondary" onClick={onClose}>
            {text.close}
          </DButton>
        </div>
      }
    >
      {item ? (
        <div className="space-y-4">
          <RecordPanel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-lg font-semibold tracking-tight text-[var(--color-text)]">
                  {actionLabel(item.eventType, locale)}
                </h2>
                <p className="mt-1 break-words text-sm text-[var(--color-text-muted)]">
                  {activityCategoryLabel(item.category, locale)}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <RecordSectionLabel>{text.time}</RecordSectionLabel>
                <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--color-text)]">
                  <time dateTime={item.occurredAt}>{formatDateTime(item.occurredAt)}</time>
                </p>
              </div>
            </div>
          </RecordPanel>

          <section aria-label={text.activityDetails} className="grid gap-3 sm:grid-cols-2">
            <RecordInfoTile
              label={text.actor}
              icon={<UserRound aria-hidden="true" className="size-3.5" />}
              value={
                item.actor ? (
                  <>
                    <span className="block">{item.actor.displayName}</span>
                    {actorContext(item.actor) ? (
                      <span className="mt-0.5 block text-xs font-normal text-[var(--color-text-muted)]">
                        {actorContext(item.actor)}
                      </span>
                    ) : null}
                  </>
                ) : item.source === 'SYSTEM' ? (
                  text.system
                ) : (
                  text.unknown
                )
              }
            />
            <RecordInfoTile
              label={text.affectedItem}
              icon={<Target aria-hidden="true" className="size-3.5" />}
              value={
                targetSummary(item, locale) ?? (
                  <span className="font-normal text-[var(--color-text-muted)]">
                    {text.noTarget}
                  </span>
                )
              }
            />
            <RecordInfoTile
              label={text.location}
              icon={<MapPin aria-hidden="true" className="size-3.5" />}
              value={
                item.locationName ?? (
                  <span className="font-normal text-[var(--color-text-muted)]">
                    {text.noLocation}
                  </span>
                )
              }
            />
            <RecordInfoTile
              label={text.source}
              icon={<MonitorSmartphone aria-hidden="true" className="size-3.5" />}
              value={sourceLabel(item.source, locale)}
            />
          </section>

          {/* Secondary by design: identifiers for tracing, never the focus of the record. */}
          <details className="group rounded-xl border border-[var(--color-border)] px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/30">
              <span>{text.technicalInformation}</span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{text.technicalHint}</p>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <TechnicalFact label={text.eventCode} value={item.eventType} />
              {item.correlationId ? (
                <TechnicalFact label={text.requestId} value={item.correlationId} />
              ) : null}
            </dl>
          </details>
        </div>
      ) : null}
    </DDialog>
  );
}

function TechnicalFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-all font-mono text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
