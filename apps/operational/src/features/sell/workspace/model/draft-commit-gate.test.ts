import { describe, expect, it, vi } from 'vitest';

import { createDraftCommitGate } from './draft-commit-gate';

describe('draft checkout submission gate', () => {
  it('shares one in-flight submission for rapid Checkout requests', async () => {
    let resolve!: (value: string) => void;
    const start = vi.fn(() => new Promise<string>((done) => (resolve = done)));
    const gate = createDraftCommitGate<string>();

    const first = gate.run(start);
    const second = gate.run(start);

    expect(start).toHaveBeenCalledTimes(1);
    resolve('sale-1');
    await expect(Promise.all([first, second])).resolves.toEqual(['sale-1', 'sale-1']);
  });
});
