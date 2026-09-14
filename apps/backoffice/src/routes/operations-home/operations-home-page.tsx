import { Boxes, Building2, Tags } from 'lucide-react';
import { DCard } from '@digvation/ui';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

const SECTIONS = [
  {
    title: { id: 'Cabang', en: 'Branches' },
    description: { id: 'Kelola lokasi penjualan.', en: 'Manage selling locations.' },
    icon: Building2,
  },
  {
    title: { id: 'Katalog', en: 'Catalog' },
    description: { id: 'Kelola item, kategori, dan varian.', en: 'Manage items, categories, and variants.' },
    icon: Boxes,
  },
  {
    title: { id: 'Harga dan pajak', en: 'Pricing and tax' },
    description: { id: 'Atur harga dan pajak.', en: 'Configure pricing and tax.' },
    icon: Tags,
  },
] as const;

export function OperationsHomePage() {
  const { locale } = useBackofficeLocalization();
  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow="Backoffice"
        title={locale === 'id' ? 'Ringkasan' : 'Overview'}
      />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {SECTIONS.map(({ title, description, icon: Icon }, index) => {
          const accents = [
            'var(--color-accent-yellow)',
            'var(--color-accent-sky)',
            'var(--color-accent-coral)',
          ] as const;

          return (
            <DCard key={title.en} className="p-5">
              <div
                className="grid size-9 place-items-center rounded-[var(--radius-control)]"
                style={{ backgroundColor: accents[index] }}
              >
                <Icon className="size-4.5 text-[var(--color-text)]" />
              </div>
              <h2 className="mt-4 text-sm font-bold">{title[locale]}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {description[locale]}
              </p>
            </DCard>
          );
        })}
      </div>
    </BackofficePage>
  );
}
