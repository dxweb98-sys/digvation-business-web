import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { operationalApplicationCopy } from '../localization/operational-application-identity';
import { operationalCopy } from '../localization/operational-localization';
import { OperationalAccessDenied } from './operational-access-denied';

afterEach(cleanup);

const copy = (value: string) => value;
const text = () => document.body.textContent ?? '';
const button = (name: string) =>
  [...document.body.querySelectorAll('button')].find((node) => node.textContent === name)!;

describe('OperationalAccessDenied', () => {
  it('explains a role without modules and never names a permission', () => {
    render(
      <OperationalAccessDenied
        reason="NO_PERMITTED_MODULE"
        copy={copy}
        application={operationalApplicationCopy(null)}
        onCheckAgain={() => Promise.resolve(false)}
        onChangeAccount={vi.fn()}
      />,
    );
    expect(text()).toContain('No Operational module is available for your account');
    expect(text()).toContain('update your role in Backoffice');
    expect(text()).not.toMatch(/sales:|customers:|payments:/);
  });

  it('explains a module that is not enabled for the business', () => {
    render(
      <OperationalAccessDenied
        reason="MODULE_NOT_ENABLED"
        copy={copy}
        application={operationalApplicationCopy(null)}
        onCheckAgain={() => Promise.resolve(false)}
        onChangeAccount={vi.fn()}
      />,
    );
    expect(text()).toContain('Operational is not enabled for this business');
    expect(text()).toContain('The modules used in Operational have not been enabled');
  });

  it('names the declared POS Salon application when it is not enabled for the business', () => {
    render(
      <OperationalAccessDenied
        reason="MODULE_NOT_ENABLED"
        copy={(value) => operationalCopy(value, 'id-ID')}
        application={operationalApplicationCopy({ operationalApplication: 'POS_SALON_APP' })}
        onCheckAgain={() => Promise.resolve(false)}
        onChangeAccount={vi.fn()}
      />,
    );
    expect(text()).toContain('POS Salon belum diaktifkan untuk bisnis ini');
    expect(text()).toContain('Modul yang dipakai di POS Salon belum diaktifkan untuk bisnis ini.');
    expect(text()).not.toMatch(/Operational|Operasional/);
  });

  it('keeps the generic module wording when POS Salon has no permitted module', () => {
    render(
      <OperationalAccessDenied
        reason="NO_PERMITTED_MODULE"
        copy={(value) => operationalCopy(value, 'id-ID')}
        application={operationalApplicationCopy({ operationalApplication: 'POS_SALON_APP' })}
        onCheckAgain={() => Promise.resolve(false)}
        onChangeAccount={vi.fn()}
      />,
    );
    expect(text()).toContain('Belum ada modul Operasional untuk akun Anda');
  });

  it('checks again and says so when access did not change', async () => {
    const check = vi.fn().mockResolvedValue(false);
    render(
      <OperationalAccessDenied
        reason="NO_PERMITTED_MODULE"
        copy={copy}
        application={operationalApplicationCopy(null)}
        onCheckAgain={check}
        onChangeAccount={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(button('Check again'));
    });
    await waitFor(() => expect(text()).toContain('Your access has not changed yet.'));
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable error when the check fails, and switches account on request', async () => {
    const change = vi.fn();
    render(
      <OperationalAccessDenied
        reason="NO_PERMITTED_MODULE"
        copy={copy}
        application={operationalApplicationCopy(null)}
        onCheckAgain={() => Promise.reject(new Error('offline'))}
        onChangeAccount={change}
      />,
    );
    await act(async () => {
      fireEvent.click(button('Check again'));
    });
    await waitFor(() => expect(text()).toContain('Access could not be checked. Try again.'));
    fireEvent.click(button('Use another account'));
    expect(change).toHaveBeenCalledTimes(1);
  });
});
