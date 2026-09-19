import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useBackofficeAuth = vi.fn();

vi.mock('./backoffice-auth-context', () => ({
  useBackofficeAuth: () => useBackofficeAuth(),
}));

vi.mock('./backoffice-login-page', () => ({
  BackofficeLoginPage: () => <p>Backoffice sign in</p>,
}));

import { AuthenticatedRoute } from './authenticated-route';

describe('AuthenticatedRoute', () => {
  beforeEach(() => {
    useBackofficeAuth.mockReset();
  });

  it('does not render protected Backoffice content after an application denial', () => {
    useBackofficeAuth.mockReturnValue({
      status: 'unauthenticated',
      session: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<AuthenticatedRoute />}>
            <Route path="/protected" element={<p>Protected shell content</p>} />
          </Route>
          <Route path="/login" element={<p>Login route</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected shell content')).toBeNull();
    expect(screen.queryByText('Backoffice sign in')).not.toBeNull();
  });

  it('allows protected content for an authenticated Backoffice session', () => {
    useBackofficeAuth.mockReturnValue({
      status: 'authenticated',
      session: { access: { permissions: ['backoffice:access'] } },
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route element={<AuthenticatedRoute />}>
            <Route path="/protected" element={<p>Protected shell content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Protected shell content')).not.toBeNull();
  });
});
