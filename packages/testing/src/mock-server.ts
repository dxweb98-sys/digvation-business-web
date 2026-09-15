import { setupServer } from 'msw/node';

export function createMockServer() {
  return setupServer();
}
