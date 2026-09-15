import { Boxes, Building2, Tags } from 'lucide-react';
import { DCard } from '@digvation/ui';

import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

type OverviewCopyKey =
  | 'overviewTitle'
  | 'overviewDescription'
  | 'branches'
  | 'branchesDescription'
  | 'catalog'
  | 'catalogDescription'
  | 'pricingTax'
  | 'pricingTaxDescription';

const overviewCopy: Record<OverviewCopyKey, { id: string; en: string }> = {
  overviewTitle: { id: 'Ringkasan Backoffice', en: 'Backoffice overview' },
  overviewDescription: {
    id: 'Kelola cabang, katalog, harga, dan pajak.',
    en: 'Manage branches, catalog, pricing, and tax.',
  },
  branches: { id: 'Cabang', en: 'Branches' },
  branchesDescription: {
    id: 'Kelola cabang dan lokasi penjualan.',
    en: 'Manage branches and selling locations.',
  },
  catalog: { id: 'Katalog', en: 'Catalog' },
  catalogDescription: {
    id: 'Kelola produk, layanan, kategori, dan varian.',
    en: 'Manage products, services, categories, and variants.',
  },
  pricingTax: { id: 'Harga dan pajak', en: 'Pricing and tax' },
  pricingTaxDescription: {
    id: 'Kelola harga dan pengaturan pajak.',
    en: 'Manage pricing and tax settings.',
  },
};

const overviewCards = [
  ['branches', 'branchesDescription', Building2],
  ['catalog', 'catalogDescription', Boxes],
  ['pricingTax', 'pricingTaxDescription', Tags],
] as const;

export function OperationsHomePage() {
  const { locale, copy } = useBackofficeLocalization();
  const text = (key: OverviewCopyKey) => overviewCopy[key][locale];

  return (
    <BackofficePage>
      <BackofficePageHeader
        eyebrow={copy('Operations')}
        title={text('overviewTitle')}
        description={text('overviewDescription')}
      />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {overviewCards.map(([titleKey, descriptionKey, Icon], index) => {
          const accents = [
            'var(--color-accent-yellow)',
            'var(--color-accent-sky)',
            'var(--color-accent-coral)',
          ] as const;

          return (
            <DCard key={titleKey} className="p-5">
              <div
                className="grid size-9 place-items-center rounded-[var(--radius-control)]"
                style={{ backgroundColor: accents[index] }}
              >
                <Icon className="size-4.5 text-[var(--color-text)]" />
              </div>
              <h2 className="mt-4 text-sm font-bold">{text(titleKey)}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {text(descriptionKey)}
              </p>
            </DCard>
          );
        })}
      </div>
    </BackofficePage>
  );
}
