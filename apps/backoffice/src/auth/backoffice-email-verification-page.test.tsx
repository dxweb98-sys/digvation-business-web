import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../app/localization/backoffice-localization-base';
import { BackofficeEmailVerificationPage } from './backoffice-email-verification-page';
import {
  PasswordRecoveryProvider,
  PasswordResetError,
  type PasswordRecoveryPort,
} from './password-recovery';

vi.mock('./backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ status: 'unauthenticated', session: null }),
}));

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const CHALLENGE = '3f1c9e0e-6a54-4a52-8d57-0d1a5a0f6a11';
const TOKEN = 'C'.repeat(43);
const LINK = `/verify-email?workspace=onboarding-test&challenge=${CHALLENGE}#token=${TOKEN}`;

function port(overrides: Partial<PasswordRecoveryPort> = {}): PasswordRecoveryPort {
  return {
    request: vi.fn(),
    confirm: vi.fn(),
    confirmEmailVerification: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPage(recovery: PasswordRecoveryPort, entry = LINK) {
  return render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <PasswordRecoveryProvider port={recovery}>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/verify-email" element={<BackofficeEmailVerificationPage />} />
              <Route path="/login" element={<p>login-page</p>} />
            </Routes>
          </MemoryRouter>
        </PasswordRecoveryProvider>
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
}

const confirmButton = () =>
  [...document.body.querySelectorAll('button')].find(
    (node) => node.textContent === 'Konfirmasi email',
  )!;

afterEach(cleanup);

describe('BackofficeEmailVerificationPage', () => {
  it('confirms only after an explicit click, then reports success', async () => {
    const recovery = port();
    renderPage(recovery);
    expect(recovery.confirmEmailVerification).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    await waitFor(() =>
      expect(recovery.confirmEmailVerification).toHaveBeenCalledWith({
        workspace: 'onboarding-test',
        challengeId: CHALLENGE,
        token: TOKEN,
      }),
    );
    await waitFor(() => expect(document.body.textContent).toContain('Email terverifikasi'));
  });

  it.each([
    ['invalid', 'Tautan tidak valid atau sudah digunakan'],
    ['expired', 'Tautan sudah kedaluwarsa'],
  ] as const)('explains a %s link', async (reason, title) => {
    renderPage(
      port({ confirmEmailVerification: vi.fn().mockRejectedValue(new PasswordResetError(reason)) }),
    );
    await act(async () => {
      fireEvent.click(confirmButton());
    });
    await waitFor(() => expect(document.body.textContent).toContain(title));
  });

  it('never calls the Runtime for a malformed link', () => {
    const recovery = port();
    renderPage(recovery, '/verify-email?workspace=onboarding-test#token=short');
    expect(document.body.textContent).toContain('Tautan tidak valid atau sudah digunakan');
    expect(recovery.confirmEmailVerification).not.toHaveBeenCalled();
  });

  it('removes the one-time token from the address bar', async () => {
    window.history.replaceState(null, '', LINK);
    renderPage(port());
    await waitFor(() => expect(window.location.hash).toBe(''));
  });
});
