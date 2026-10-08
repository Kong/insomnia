/**
 * Tests run against the in-memory NeDB initialized by setup-vitest.ts. localStorage is stubbed
 * per-test; getUserEntitlements is mocked so calls can be counted without hitting the network.
 */

import type * as InsomniaApi from 'insomnia-api';
import { initDatabase } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mainDatabase } from '../main/database.main';
import { refreshKonnectAccess } from './organization-utils';

const getUserEntitlementsMock = vi.fn();

vi.mock('insomnia-api', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaApi>();
  return {
    ...actual,
    getUserEntitlements: (...args: unknown[]) => getUserEntitlementsMock(...args),
  };
});

const ACCOUNT_ID = 'acct_1';

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

beforeEach(async () => {
  await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
  stubLocalStorage();
  getUserEntitlementsMock.mockReset();
  getUserEntitlementsMock.mockResolvedValue({ entitlements: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// `konnectAccessResolvedFor` is module-level state that outlives any single call, so every phase
// of the dedup behavior is exercised in one test — splitting it across `it()` blocks would leak
// state between them (the module isn't re-imported per test).
describe('refreshKonnectAccess', () => {
  it('dedupes by session, not account, and force always re-fetches', async () => {
    await refreshKonnectAccess('session-1', ACCOUNT_ID);
    expect(getUserEntitlementsMock).toHaveBeenCalledTimes(1);

    // Re-entering the same session (e.g. re-running the post-login loader on a cold start) must
    // not issue a second request.
    await refreshKonnectAccess('session-1', ACCOUNT_ID);
    expect(getUserEntitlementsMock).toHaveBeenCalledTimes(1);

    // Logging out and back into the *same* account mints a new session token. Signing in never
    // reloads the renderer, so this must still trigger a real re-fetch rather than silently
    // reusing the stale answer from the previous session.
    await refreshKonnectAccess('session-2', ACCOUNT_ID);
    expect(getUserEntitlementsMock).toHaveBeenCalledTimes(2);

    // `force` bypasses the dedup guard even for the session already resolved.
    await refreshKonnectAccess('session-2', ACCOUNT_ID, { force: true });
    expect(getUserEntitlementsMock).toHaveBeenCalledTimes(3);
  });
});
