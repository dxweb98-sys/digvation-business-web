import { DEmptyState } from '@digvation/ui';
import { BackofficePage, BackofficePageHeader } from '../../app/layout/backoffice-page';
import {
  type BackofficeMessageKey,
  useBackofficeLocalization,
} from '../../app/localization/backoffice-localization';

export function PlaceholderPage({ title }: { title: BackofficeMessageKey }) {
  const { t, locale } = useBackofficeLocalization();
  return (
    <BackofficePage>
      <BackofficePageHeader title={t(title)} />
      <DEmptyState
        className="mt-6"
        title={locale === 'id' ? 'Belum tersedia' : 'Not available yet'}
        description={
          locale === 'id' ? 'Halaman ini belum tersedia.' : 'This page is not available yet.'
        }
      />
    </BackofficePage>
  );
}
