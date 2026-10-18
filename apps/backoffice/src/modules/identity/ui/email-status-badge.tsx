import { DBadge } from '@digvation/ui';

import { useBackofficeLocalization } from '../../../app/localization/backoffice-localization';
import type { EmailStatus } from '../model/identity-form';

const VARIANT = { MISSING: 'secondary', UNVERIFIED: 'warning', VERIFIED: 'success' } as const;
const LABEL = {
  MISSING: 'Email not set',
  UNVERIFIED: 'Not verified',
  VERIFIED: 'Verified',
} as const;

/** Email verification state in words, never by color alone. */
export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const { copy } = useBackofficeLocalization();
  return <DBadge variant={VARIANT[status]}>{copy(LABEL[status])}</DBadge>;
}
