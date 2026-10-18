import { act, render, within } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BackofficeStartup,
  BackofficeStartupSplash,
  remainingSplashTime,
  SPLASH_MINIMUM_VISIBLE_MS,
  useBackofficeStartupReady,
  type BackofficeStartupResult,
} from './backoffice-startup';

const branding = { mode: 'DIGVATION_DEFAULT', productName: 'Digvation Business' } as const;

function ReadyApplication() {
  const markReady = useBackofficeStartupReady();
  useEffect(() => markReady(), [markReady]);
  return <p>Application</p>;
}

describe('remainingSplashTime', () => {
  it('waits only for the unused part of the minimum visible duration', () => {
    expect(remainingSplashTime(1_000, 1_100, 450)).toBe(350);
    expect(remainingSplashTime(1_000, 2_000, 450)).toBe(0);
  });
});

describe('BackofficeStartupSplash', () => {
  it('reserves the product line before deployment bootstrap resolves', () => {
    const { container } = render(<BackofficeStartupSplash />);

    expect(within(container).queryByText('Menyiapkan Backoffice')).not.toBeNull();
    expect(within(container).getByRole('heading', { level: 1 }).textContent).toBe(' ');
  });
});

describe('BackofficeStartup', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts the application immediately and removes the splash after the minimum duration', async () => {
    vi.useFakeTimers();
    const startup = Promise.resolve<BackofficeStartupResult>({
      branding,
      element: <ReadyApplication />,
    });

    const { container } = render(
      <BackofficeStartup startup={startup} renderFailure={() => <p>Failed</p>} />,
    );
    await act(async () => {
      await startup;
    });

    expect(within(container).queryByText('Application')).not.toBeNull();
    expect(container.querySelector('.backoffice-startup-splash')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(SPLASH_MINIMUM_VISIBLE_MS);
    });
    expect(container.querySelector('.backoffice-startup-splash--leaving')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(container.querySelector('.backoffice-startup-splash')).toBeNull();
  });

  it('replaces the splash with the startup failure view', async () => {
    const startup = Promise.reject(new Error('bootstrap unavailable'));

    const { container } = render(
      <BackofficeStartup startup={startup} renderFailure={() => <p>Failed</p>} />,
    );
    await act(async () => {
      await startup.catch(() => undefined);
    });

    expect(within(container).queryByText('Failed')).not.toBeNull();
    expect(container.querySelector('.backoffice-startup-splash')).toBeNull();
  });
});
