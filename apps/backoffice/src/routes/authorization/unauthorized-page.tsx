import { SystemState } from '@digvation/business-system-states';
import { DButton } from '@digvation/ui';
import { useNavigate } from 'react-router';
import { BackofficePage } from '../../app/layout/backoffice-page';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  return (
    <BackofficePage>
      <SystemState
        state="forbidden"
        action={
          <DButton variant="secondary" size="sm" onClick={() => navigate('/')}>
            Kembali
          </DButton>
        }
      />
    </BackofficePage>
  );
}
