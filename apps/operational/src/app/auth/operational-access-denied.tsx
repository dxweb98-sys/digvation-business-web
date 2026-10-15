import { DAlert, DButton } from '@digvation/ui';
import { LockKeyhole } from 'lucide-react';
import { useState } from 'react';

import type { OperationalDenial } from '../../shared/operational-access/operational-surface-access';

/**
 * Signed in, but no Operational module can be opened. It explains what is missing in everyday
 * terms (never which permission), and offers the two actions that exist today: check again after an
 * administrator changed the role, or sign out to use another account.
 */
export function OperationalAccessDenied({
  reason,
  onCheckAgain,
  onChangeAccount,
  copy,
}: {
  copy: (value: string) => string;
  reason: OperationalDenial;
  /** Resolves true when the access changed and the session was replaced. */
  onCheckAgain: () => Promise<boolean>;
  onChangeAccount: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [unchanged, setUnchanged] = useState(false);
  const [failed, setFailed] = useState(false);

  const checkAgain = async () => {
    if (checking) return;
    setChecking(true);
    setUnchanged(false);
    setFailed(false);
    try {
      const changed = await onCheckAgain();
      if (!changed) setUnchanged(true);
    } catch {
      setFailed(true);
    } finally {
      setChecking(false);
    }
  };

  const notEnabled = reason === 'MODULE_NOT_ENABLED';

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-background)] p-6">
      <section
        aria-labelledby="operational-denied-title"
        className="w-full max-w-md rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm"
      >
        <span className="grid size-10 place-items-center rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </span>
        <h1 id="operational-denied-title" className="mt-4 text-lg font-semibold">
          {copy(
            notEnabled
              ? 'Operational is not enabled for this business'
              : 'No Operational module is available for your account',
          )}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
          {copy(
            notEnabled
              ? 'The modules used in Operational have not been enabled for this business. Contact your business administrator.'
              : 'Your role does not include Sell, Customers or Expenses. Ask your business administrator to update your role in Backoffice, then check again.',
          )}
        </p>
        <div aria-live="polite">
          {unchanged ? (
            <DAlert variant="warning" className="mt-4">
              {copy('Your access has not changed yet.')}
            </DAlert>
          ) : null}
          {failed ? (
            <DAlert variant="danger" role="alert" className="mt-4">
              {copy('Access could not be checked. Try again.')}
            </DAlert>
          ) : null}
        </div>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <DButton variant="secondary" onClick={onChangeAccount} disabled={checking}>
            {copy('Use another account')}
          </DButton>
          <DButton loading={checking} onClick={() => void checkAgain()}>
            {copy('Check again')}
          </DButton>
        </div>
      </section>
    </main>
  );
}
