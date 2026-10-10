/**
 * Preview servers managed by playwright.config.ts. Specs import these instead of hardcoding
 * ports, and nothing depends on Vite dev servers (which do not exist in CI).
 */
export const OPERATIONAL_URL = 'http://127.0.0.1:4173';
export const BACKOFFICE_URL = 'http://127.0.0.1:4174';
