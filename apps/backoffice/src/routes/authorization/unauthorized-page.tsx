import { DButton, DEmptyState } from '@digvation/ui';
import { useNavigate } from 'react-router';
import { BackofficePage } from '../../app/layout/backoffice-page';
import { useBackofficeLocalization } from '../../app/localization/backoffice-localization';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { t } = useBackofficeLocalization();
  return <BackofficePage><DEmptyState title={t('accessUnavailable')} description={t('accessUnavailableDescription')} action={<DButton variant="secondary" size="sm" onClick={() => navigate('/')}>{t('goToDashboard')}</DButton>} /></BackofficePage>;
}
