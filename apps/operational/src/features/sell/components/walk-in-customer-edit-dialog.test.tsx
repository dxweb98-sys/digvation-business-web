import {
  DeploymentBootstrapProvider,
  type DeploymentBootstrapConfig,
} from '@digvation/business-runtime';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WalkInCustomerEditDialog,
  type WalkInCustomerEditTarget,
} from './walk-in-customer-edit-dialog';

const bootstrap = {
  apiBaseUrl: '',
  deploymentProfile: 'DEDICATED',
  workspaceResolution: { mode: 'FIXED', workspace: 'staging' },
  applications: { backoffice: true, operational: true },
  branding: { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' },
  theme: { preset: 'DIGVATION_LIGHT', radius: 'SOFT' },
  defaults: { locale: 'id-ID', country: 'ID' },
} satisfies DeploymentBootstrapConfig;

const TARGET: WalkInCustomerEditTarget = {
  saleId: 'sale-1',
  reference: 'TRX-20261003-000182',
  customer: { name: 'wirawan', phoneE164: '+6281231231231' },
};

function setup(onSave = vi.fn(async () => undefined)) {
  render(
    <DeploymentBootstrapProvider config={bootstrap}>
      <WalkInCustomerEditDialog target={TARGET} onClose={vi.fn()} onSave={onSave} />
    </DeploymentBootstrapProvider>,
  );
  const name = screen.getByLabelText('Nama Pelanggan', { selector: 'input' }) as HTMLInputElement;
  const phone = screen.getByLabelText('Nomor WhatsApp / Telepon', {
    selector: 'input',
  }) as HTMLInputElement;
  return { onSave, name, phone, save: () => screen.getByRole('button', { name: 'Simpan' }) };
}

describe('WalkInCustomerEditDialog', () => {
  afterEach(cleanup);

  it('starts from the current transaction snapshot and cannot save an unchanged form', () => {
    const { name, phone, save } = setup();

    expect(name.value).toBe('wirawan');
    expect(phone.value).toBe('081231231231');
    expect(save().hasAttribute('disabled')).toBe(true);
  });

  it('saves the corrected name and the canonical number', async () => {
    const { onSave, name, phone, save } = setup();

    fireEvent.change(name, { target: { value: '  Wirawan   Saputra ' } });
    fireEvent.change(phone, { target: { value: '+62812 9999 8888' } });
    expect(phone.value).toBe('081299998888');
    fireEvent.click(save());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith('sale-1', {
      name: 'Wirawan Saputra',
      phone: '+6281299998888',
    });
  });

  it('refuses an unusable number or an empty name without calling Runtime', async () => {
    const { onSave, name, phone, save } = setup();

    fireEvent.change(phone, { target: { value: '12' } });
    fireEvent.click(save());
    expect(
      await screen.findByText('Masukkan nomor WhatsApp yang valid, contoh 081234567890.'),
    ).toBeTruthy();

    fireEvent.change(name, { target: { value: '   ' } });
    expect(await screen.findByText('Masukkan nama pelanggan.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a safe message when the correction is rejected', async () => {
    const onSave = vi.fn(async () => {
      throw new Error('SALE_NOT_OPEN');
    });
    const { name, save } = setup(onSave);

    fireEvent.change(name, { target: { value: 'Wirawan S' } });
    fireEvent.click(save());

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
