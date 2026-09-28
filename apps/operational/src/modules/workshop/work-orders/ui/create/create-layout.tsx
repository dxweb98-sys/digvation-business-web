import { DTabs, DTabsContent, DTabsList, DTabsTrigger } from '@digvation/ui';
import type { ReactNode } from 'react';

import type { LookupMode } from '../../model/use-create-work-order';

/** One section heading for every intake step. */
export function SectionHeader({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h3 id={id} className="text-lg font-bold tracking-tight text-(--color-text)">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-[13px] text-(--color-text-muted)">{description}</p>
      ) : null}
    </div>
  );
}

const modeTabClass =
  '-mb-px flex-none rounded-none border-0 border-b-2! border-transparent bg-transparent! px-4 py-2.5 shadow-none! aria-selected:border-(--color-brand)! aria-selected:text-(--color-brand)!';

/** The single mode switch shared by the Customer and Vehicle steps (Digvation DTabs). */
export function LookupModeTabs({
  value,
  onValueChange,
  tabs,
  panels,
  className,
}: {
  value: LookupMode;
  onValueChange: (value: LookupMode) => void;
  tabs: { value: LookupMode; label: string }[];
  panels: Record<LookupMode, ReactNode>;
  className?: string;
}) {
  return (
    <DTabs
      className={className}
      value={value}
      defaultValue="existing"
      onValueChange={(next) => onValueChange(next as LookupMode)}
    >
      <DTabsList className="flex w-full gap-1 rounded-none border-b border-(--color-border) bg-transparent p-0">
        {tabs.map((tab) => (
          <DTabsTrigger key={tab.value} value={tab.value} className={modeTabClass}>
            {tab.label}
          </DTabsTrigger>
        ))}
      </DTabsList>
      {tabs.map((tab) => (
        <DTabsContent key={tab.value} value={tab.value} className="mt-4">
          {panels[tab.value]}
        </DTabsContent>
      ))}
    </DTabs>
  );
}
