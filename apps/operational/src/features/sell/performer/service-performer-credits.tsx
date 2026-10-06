import { DBadge as Badge, DButton } from '@digvation-labs/ui';
import { DAvatar } from '@digvation/ui';
import { ChevronDown, Pencil, UserPlus } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useOperationalLocalization } from '../../../app/localization/operational-localization';
import type { PerformerCredit, servicePerformerSummary } from './service-performer-summary';

/** Distinct settings listed before the rest folds away, keeping long lines scannable. */
const VISIBLE_PERFORMER_GROUPS = 3;

/** Avatars stacked for one shared unit; more people than this collapse into the names. */
const VISIBLE_AVATARS = 3;

/**
 * Who works one unit. The avatar carries identity so the name reads as a
 * person. Several people on ONE unit overlap their avatars and add a
 * "Shared work" caption; that is what tells it apart from several quantity
 * units, which are listed as separate rows instead.
 */
function PerformerCredits({
  performers,
  allWork = false,
}: {
  performers: readonly PerformerCredit[];
  /** The same person performs every unit of a quantity above one. */
  allWork?: boolean;
}) {
  const { copy } = useOperationalLocalization();
  if (!performers.length)
    return (
      <span className="flex min-h-6 items-center">
        <Badge variant="warning" dot>
          {copy('No employee yet')}
        </Badge>
      </span>
    );
  const shared = performers.length > 1;
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="mt-0 flex shrink-0 -space-x-1.5" aria-hidden="true">
        {performers.slice(0, VISIBLE_AVATARS).map((performer) => (
          <DAvatar
            key={performer.employeeId}
            size="xs"
            name={performer.name}
            className="rounded-full ring-2 ring-[var(--color-surface)]"
          />
        ))}
      </span>
      <span className="min-w-0">
        <span className="block break-words text-xs leading-6">
          {performers.map((performer, index) => (
            <span key={performer.employeeId}>
              {index > 0 ? <span className="text-[var(--color-text-muted)]">, </span> : null}
              <span className="font-medium text-[var(--color-text)]">{performer.name}</span>
              {performer.percent ? (
                <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-[var(--color-text-muted)]">
                  {performer.percent}
                </span>
              ) : null}
            </span>
          ))}
          {allWork ? (
            <span className="text-xs text-[var(--color-text-muted)]"> · {copy('All work')}</span>
          ) : null}
        </span>
        {shared ? (
          <span className="block text-[11px] leading-4 text-[var(--color-text-muted)]">
            {copy('Shared work')}
          </span>
        ) : null}
      </span>
    </span>
  );
}

/**
 * Who performs one service line, and the action that changes it, as ONE block:
 * the action sits on the same row as the people it edits. One setting is one
 * row; a structured "Work 1 / Work 2" list appears only when units really
 * differ. Quantity is never repeated as names.
 */
export function ServicePerformers({
  itemName,
  summary,
  needsAttention,
  editable,
  disabled,
  onEdit,
}: {
  itemName: string;
  summary: ReturnType<typeof servicePerformerSummary>;
  needsAttention: boolean;
  editable: boolean;
  disabled: boolean;
  onEdit: () => void;
}) {
  const { copy } = useOperationalLocalization();
  const [expanded, setExpanded] = useState(false);
  const { unitCount, groups } = summary;
  const varied = groups.length > 1;
  const foldable = groups.length > VISIBLE_PERFORMER_GROUPS;
  const shown = foldable && !expanded ? groups.slice(0, VISIBLE_PERFORMER_GROUPS - 1) : groups;
  const hiddenCount = groups.length - shown.length;

  return (
    <div
      role="group"
      aria-label={`${copy('Performed by')}: ${itemName}`}
      className="mt-2 flex min-w-0 items-start justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        {varied ? (
          <>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
              {shown.map((group) => (
                <Fragment key={group.units}>
                  <dt className="whitespace-nowrap text-xs leading-6 tabular-nums text-[var(--color-text-muted)]">
                    {copy('Work')} {group.units}
                  </dt>
                  <dd className="m-0 min-w-0">
                    <PerformerCredits performers={group.performers} />
                  </dd>
                </Fragment>
              ))}
            </dl>
            {foldable ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-md text-xs font-semibold text-[var(--color-brand)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/30"
              >
                {expanded ? copy('Show less') : `${copy('Show')} ${hiddenCount} ${copy('more')}`}
                <ChevronDown
                  className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : null}
          </>
        ) : (
          <PerformerCredits
            performers={groups[0]?.performers ?? []}
            allWork={unitCount > 1 && (groups[0]?.performers.length ?? 0) > 0}
          />
        )}
      </div>
      {editable ? (
        needsAttention ? (
          <DButton
            size="sm"
            variant="soft"
            disabled={disabled}
            leftIcon={<UserPlus className="size-3.5" aria-hidden="true" />}
            aria-label={`${copy('Choose employee')}: ${itemName}`}
            className="-mt-0.5 h-7 shrink-0 px-2"
            onClick={onEdit}
          >
            {copy('Choose employee')}
          </DButton>
        ) : (
          <DButton
            size="icon"
            variant="ghost"
            disabled={disabled}
            title={copy('Change employee')}
            aria-label={`${copy('Change employee')}: ${itemName}`}
            className="-my-1 -mr-1.5 size-8 shrink-0 text-[var(--color-text-muted)]"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </DButton>
        )
      ) : null}
    </div>
  );
}
