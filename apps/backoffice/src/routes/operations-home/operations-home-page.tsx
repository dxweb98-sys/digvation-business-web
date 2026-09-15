import { Boxes, Building2, Tags } from 'lucide-react';
import { DCard } from '@digvation/ui';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const UPCOMING = [
  ['Branches', Building2, 'Branch configuration maps to the backend Selling Location contract.'],
  ['Catalog', Boxes, 'Items, categories and variants will use approved backend contracts.'],
  ['Pricing & Tax', Tags, 'Financial configuration remains backend authoritative.'],
] as const;

export function OperationsHomePage() {
  const { copy } = useBackofficeLocalization();
  return (
    <BackofficePage>
      <BackofficePageHeader eyebrow={copy('Operations')} title={copy('Backoffice foundation')} description={copy('No fake dashboard metrics are shown. Management capabilities appear only when their backend contract and frontend checkpoint are approved.')} />

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {UPCOMING.map(([title, Icon, description], index) => {
            const accents = [
              'var(--color-accent-yellow)',
              'var(--color-accent-sky)',
              'var(--color-accent-coral)',
            ] as const;

            return (
              <DCard
                key={title}
                className="p-5"
              >
                <div
                  className="grid size-9 place-items-center rounded-[var(--radius-control)]"
                  style={{ backgroundColor: accents[index] }}
                >
                  <Icon className="size-4.5 text-[var(--color-text)]" />
                </div>
                <h2 className="mt-4 text-sm font-bold">{copy(title)}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                  {description}
                </p>
              </DCard>
            );
          })}
        </div>
    </BackofficePage>
  );
}
