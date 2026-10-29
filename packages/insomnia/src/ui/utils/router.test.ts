import type * as InsomniaData from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaData>();
  return {
    ...actual,
    services: {
      ...actual.services,
      userSession: { ...actual.services.userSession, get: vi.fn() },
      project: { ...actual.services.project, list: vi.fn() },
    },
  };
});

import { services } from 'insomnia-data';

import { HAS_SEEN_ONBOARDING_KEY } from '~/common/constants';

import { getInitialEntry } from './router';

describe('getInitialEntry', () => {
  beforeEach(() => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: 'sess_1', accountId: 'acct_1' } as any);
    vi.mocked(services.project.list).mockResolvedValue([]);
    const storage = new Map([[HAS_SEEN_ONBOARDING_KEY, 'true']]);
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leaves picking the organization to the organization index route when signed in', async () => {
    // Even without a cached organization list: the route fetches it.
    expect(await getInitialEntry()).toBe('/organization');
  });
});
