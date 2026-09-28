import { cn } from '@digvation/ui';
import { Check } from 'lucide-react';
import { Fragment } from 'react';

import type { CreateStep, CreateWorkOrderController } from '../../model/use-create-work-order';

function StepIndicator({
  step,
  current,
  label,
  enabled,
  done,
  onSelect,
}: {
  step: CreateStep;
  current: CreateStep;
  label: string;
  enabled: boolean;
  done: boolean;
  onSelect: () => void;
}) {
  const active = current === step;

  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onSelect}
      aria-current={active ? 'step' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-2 py-1.5 text-left outline-none focus-visible:underline',
        enabled ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold transition-colors',
          active && 'border-(--color-brand) bg-(--color-brand) text-white',
          !active && done && 'border-(--color-brand)/30 bg-(--color-brand)/10 text-(--color-brand)',
          !active &&
            !done &&
            'border-(--color-border) bg-(--color-surface-muted) text-(--color-text-muted)',
        )}
      >
        {done && !active ? <Check className="size-4" aria-hidden="true" /> : step}
      </span>
      <span
        className={cn(
          'whitespace-nowrap text-[13px] font-medium leading-4',
          active ? 'text-(--color-brand)' : 'text-(--color-text)',
          !active && 'hidden sm:inline',
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function CreateStepper({
  intake,
  copy,
}: {
  intake: CreateWorkOrderController;
  copy: (value: string) => string;
}) {
  const { step, setStep, selectedCustomer, vehicleReady, customerRequest, canAdvanceVehicle } =
    intake;
  const steps = [
    { step: 1 as const, label: copy('Customer'), enabled: true, done: Boolean(selectedCustomer) },
    {
      step: 2 as const,
      label: copy('Vehicle'),
      enabled: Boolean(selectedCustomer),
      done: vehicleReady,
    },
    {
      step: 3 as const,
      label: copy('Complaint & Summary'),
      enabled: canAdvanceVehicle,
      done: Boolean(customerRequest.trim()),
    },
  ];

  return (
    <div className="flex items-center gap-3">
      {steps.map((item, index) => (
        <Fragment key={item.step}>
          <StepIndicator
            step={item.step}
            current={step}
            label={item.label}
            enabled={item.enabled}
            done={item.done}
            onSelect={() => setStep(item.step)}
          />
          {index < steps.length - 1 ? (
            <span
              aria-hidden="true"
              className={cn(
                'h-px min-w-3 flex-1 bg-(--color-border)',
                item.done && 'bg-(--color-brand)/30',
              )}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}
