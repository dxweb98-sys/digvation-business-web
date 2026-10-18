import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SystemState } from './src/system-state';

describe('SystemState', () => {
  it('renders the canonical not-found state and its recovery action', () => {
    render(<SystemState state="not-found" action={<button type="button">Go to home</button>} />);

    expect(screen.getByText('Halaman tidak ditemukan')).toBeInTheDocument();
    expect(screen.getByText('Go to home')).toBeInTheDocument();
  });
});
