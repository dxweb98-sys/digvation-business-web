import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { PosCurrencyInput } from './pos-controls';

/** The manual fixed discount field: what the operator sees versus the exact value sent. */
function Field({ initial = '', onValue }: { initial?: string; onValue: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <PosCurrencyInput
      label="Nominal diskon"
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

afterEach(cleanup);

describe('Fixed discount amount field', () => {
  it('shows rupiah grouping while keeping the exact whole-rupiah value', () => {
    const seen: string[] = [];
    render(<Field onValue={(value) => seen.push(value)} />);
    const input = screen.getByLabelText('Nominal diskon') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50000' } });
    expect(seen.at(-1)).toBe('50000');
    expect(input.value).toMatch(/^50[.,]000$/);
  });

  it('never multiplies a pasted grouped amount', () => {
    const seen: string[] = [];
    render(<Field onValue={(value) => seen.push(value)} />);
    const input = screen.getByLabelText('Nominal diskon') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.500.000' } });
    expect(seen.at(-1)).toBe('1500000');
  });

  it('shows a Runtime amount with scale as whole rupiah, not a thousand times larger', () => {
    render(<Field initial="25000.0000" onValue={() => undefined} />);
    const input = screen.getByLabelText('Nominal diskon') as HTMLInputElement;
    expect(input.value).toMatch(/^25[.,]000$/);
  });
});
