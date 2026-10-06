import { useState } from 'react';

type PaymentDialogStep = 'edit' | 'review' | 'leave';

export type PaymentAllocationMode = 'FULL' | 'SPLIT';

export function usePaymentAllocationMode(open: boolean) {
  const [mode, setMode] = useState<PaymentAllocationMode>('FULL');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMode('FULL');
  }
  return [mode, setMode] as const;
}

/**
 * Keeps the confirmation step inside the payment dialog so Escape, overlay and focus handling stay
 * with one DS dialog. It resets to editing whenever the dialog is reopened.
 */
export function usePaymentDialogStep(open: boolean) {
  const [step, setStep] = useState<PaymentDialogStep>('edit');
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep('edit');
  }
  return [step, setStep] as const;
}
