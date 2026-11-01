import { describe, expect, it } from 'vitest';

import {
  operationalApplicationCopy,
  operationalDocumentTitle,
} from './operational-application-identity';
import { operationalCopy } from './operational-localization';

describe('operationalApplicationCopy', () => {
  it('keeps the legacy Operational application name when no identity is declared', () => {
    for (const bootstrap of [{}, null, undefined]) {
      expect(operationalApplicationCopy(bootstrap)).toMatchObject({
        name: 'Operational',
        signIn: 'Sign in to Operational',
        preparing: 'Preparing Operational',
      });
    }
  });

  it('presents POS Salon when the deployment declares the POS Salon application', () => {
    const application = operationalApplicationCopy({ operationalApplication: 'POS_SALON_APP' });

    expect(application.name).toBe('POS Salon');
    expect(operationalCopy(application.name, 'id-ID')).toBe('POS Salon');
    expect(operationalCopy(application.name, 'en-US')).toBe('POS Salon');
    expect(operationalCopy(application.signIn, 'id-ID')).toBe('Masuk ke POS Salon');
    expect(operationalCopy(application.signIn, 'en-US')).toBe('Sign in to POS Salon');
    expect(operationalCopy(application.preparing, 'id-ID')).toBe('Menyiapkan POS Salon');
    expect(operationalCopy(application.preparing, 'en-US')).toBe('Preparing POS Salon');
  });
});

describe('operationalDocumentTitle', () => {
  const branding = { mode: 'DIGVATION_DEFAULT' as const, productName: 'Digvation' };

  it('keeps the legacy Operational title without a declared application identity', () => {
    expect(operationalDocumentTitle({ branding })).toBe('Digvation - Operational');
  });

  it('titles the tab POS Salon when the deployment declares it', () => {
    expect(operationalDocumentTitle({ branding, operationalApplication: 'POS_SALON_APP' })).toBe(
      'Digvation - POS Salon',
    );
  });
});
