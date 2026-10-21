import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BackofficeLocalizationProvider } from '../../../app/localization/backoffice-localization-base';
import type { ActivityEvent } from '../api/activity-api';
import { ActivityDetailDialog } from './activity-detail-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'test' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

vi.mock('../../../auth/backoffice-auth-context', () => ({
  useBackofficeAuth: () => ({ session: null }),
  isSessionExpiredError: () => false,
}));

const REQUEST_ID = '9f3c2b1a-1111-4222-8333-444455556666';
const longLocation = 'Cabang Balaraja Timur Dekat Pasar Tradisional dan Terminal Bus Antarkota';

const event = (overrides: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id: 'event-1',
  occurredAt: '2026-10-21T03:15:00.000Z',
  eventType: 'SALE_REVERSED',
  category: 'SALES',
  targetType: 'SALE',
  targetRef: 'sale-1',
  correlationId: REQUEST_ID,
  locationId: 'location-1',
  locationName: longLocation,
  source: 'BACKOFFICE',
  outcome: 'SUCCEEDED',
  actor: { id: 'user-1', displayName: 'Dewi Pemilik', username: 'dewi', roleNames: ['Owner'] },
  target: { type: 'SALE', displayName: 'TRX-20261021-000007' },
  ...overrides,
});

function renderDialog(item: ActivityEvent | null) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <BackofficeLocalizationProvider>
        <ActivityDetailDialog item={item} onClose={() => undefined} />
      </BackofficeLocalizationProvider>
    </DeploymentBootstrapProvider>,
  );
  return within(screen.getByRole('dialog', { name: 'Detail aktivitas' }));
}

afterEach(cleanup);

describe('Activity detail', () => {
  it('leads with what happened and its outcome, then who, on what, where and from where', () => {
    const dialog = renderDialog(event());
    expect(dialog.getByRole('heading', { level: 2 })).toBeTruthy();
    expect(dialog.getByText('Berhasil')).toBeTruthy();
    expect(dialog.getByText('Dewi Pemilik')).toBeTruthy();
    expect(dialog.getByText('@dewi · Owner')).toBeTruthy();
    expect(dialog.getByText(/TRX-20261021-000007/)).toBeTruthy();
    expect(dialog.getByText(longLocation)).toBeTruthy();
    expect(dialog.getByText('Backoffice')).toBeTruthy();
    expect(dialog.getByText('Riwayat aktivitas tidak dapat diubah.')).toBeTruthy();
  });

  it('keeps the request ID as secondary technical information', () => {
    const dialog = renderDialog(event());
    const technical = dialog.getByText('Informasi teknis').closest('details')!;
    expect(technical.open).toBe(false);
    expect(within(technical).getByText(REQUEST_ID)).toBeTruthy();
    // The identifier is never part of the primary record.
    const primary = dialog.getByRole('region', { name: 'Detail aktivitas' });
    expect(primary.textContent).not.toContain(REQUEST_ID);
  });

  it('says plainly when there is no actor, target or location, without inventing one', () => {
    const dialog = renderDialog(
      event({
        actor: null,
        source: 'SYSTEM',
        target: null,
        locationName: null,
        correlationId: null,
      }),
    );
    expect(dialog.getAllByText('Sistem').length).toBeGreaterThan(0);
    expect(dialog.getByText('Tidak ada objek terkait')).toBeTruthy();
    expect(dialog.getByText('Tidak terkait lokasi')).toBeTruthy();
    expect(dialog.queryByText('ID permintaan')).toBeNull();
  });
});
