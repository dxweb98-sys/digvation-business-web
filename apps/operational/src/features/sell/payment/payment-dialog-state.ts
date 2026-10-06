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
 * with one DS dialog. It resets to editing whenever the dialog is reopened. A closing dialog keeps
 * showing the step it was closed from, so its exit transition never snaps back to the edit layout.
 */
export function usePaymentDialogStep(open: boolean) {
  const [step, setStep] = useState<PaymentDialogStep>('edit');
  const [wasOpen, setWasOpen] = useState(open);
  const [shownStep, setShownStep] = useState<PaymentDialogStep>(step);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setStep('edit');
  }
  if (open && step !== shownStep) setShownStep(step);
  return [open ? step : shownStep, setStep] as const;
}
