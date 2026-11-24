import type * as InsomniaData from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as CommonConstants from '~/common/constants';

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaData>();
  return {
    ...actual,
    services: {
      ...actual.services,
      userSession: { ...actual.services.userSession, get: vi.fn() },
      project: { ...actual.services.project, list: vi.fn(), get: vi.fn() },
    },
  };
});

vi.mock('~/common/constants', async importOriginal => {
  const actual = await importOriginal<typeof CommonConstants>();
  return { ...actual, getAppVersion: vi.fn(actual.getAppVersion) };
});

vi.mock('~/ui/organization-utils', () => ({
  getKonnectOrganizationEscapeRoute: vi.fn(),
}));

import { models, services } from 'insomnia-data';

import { getAppVersion, HAS_SEEN_ONBOARDING_KEY, ONBOARDING_VERSION } from '~/common/constants';
import { getKonnectOrganizationEscapeRoute } from '~/ui/organization-utils';

import { getInitialEntry } from './router';

const ACCOUNT_ID = 'acct_1';
const SESSION_ID = 'sess_1';
const REAL_ORGANIZATION_ID = 'org_real_1';
const KONNECT_ORGANIZATION_ID = models.organization.getKonnectOrganizationId(ACCOUNT_ID);

function stubLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  // `getInitialEntry` reads some keys via bare `localStorage` and others via `window.localStorage` —
  // both need to resolve to the same store.
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
  return store;
}

describe('getInitialEntry', () => {
  beforeEach(() => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: SESSION_ID, accountId: ACCOUNT_ID } as any);
    vi.mocked(services.project.list).mockResolvedValue([]);
    vi.mocked(services.project.get).mockResolvedValue(undefined as any);
    vi.mocked(getKonnectOrganizationEscapeRoute).mockReset();
    stubLocalStorage({
      [HAS_SEEN_ONBOARDING_KEY]: 'true',
      [`${ACCOUNT_ID}:spaces`]: JSON.stringify([{ id: REAL_ORGANIZATION_ID, name: 'Real Org' }]),
      lastVisitedOrganizationId: KONNECT_ORGANIZATION_ID,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes to a real organization when the last-visited Konnect organization is no longer visible', async () => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(`/organization/${REAL_ORGANIZATION_ID}`);

    const entry = await getInitialEntry();

    expect(getKonnectOrganizationEscapeRoute).toHaveBeenCalledWith(KONNECT_ORGANIZATION_ID);
    expect(entry).toMatchObject({ pathname: `/organization/${REAL_ORGANIZATION_ID}` });
    // Must not have tried to resolve a route *inside* the now-invisible organization.
    expect(services.project.get).not.toHaveBeenCalled();
  });

  it('still restores the Konnect organization when it remains visible', async () => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(null);

    const entry = await getInitialEntry();

    expect(getKonnectOrganizationEscapeRoute).toHaveBeenCalledWith(KONNECT_ORGANIZATION_ID);
    expect(entry).toMatchObject({ pathname: `/organization/${KONNECT_ORGANIZATION_ID}/project` });
  });

  it('never consults the escape route for a real organization', async () => {
    stubLocalStorage({
      [HAS_SEEN_ONBOARDING_KEY]: 'true',
      [`${ACCOUNT_ID}:spaces`]: JSON.stringify([{ id: REAL_ORGANIZATION_ID, name: 'Real Org' }]),
      lastVisitedOrganizationId: REAL_ORGANIZATION_ID,
    });

    const entry = await getInitialEntry();

    expect(getKonnectOrganizationEscapeRoute).not.toHaveBeenCalled();
    expect(entry).toMatchObject({ pathname: `/organization/${REAL_ORGANIZATION_ID}/project` });
  });
});

describe('getInitialEntry onboarding', () => {
  const ONBOARDING_ROUTE = '/onboarding/';
  const [major, minor] = ONBOARDING_VERSION.split('.').map(Number);

  beforeEach(() => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: SESSION_ID, accountId: ACCOUNT_ID } as any);
    vi.mocked(services.project.list).mockResolvedValue([]);
    vi.mocked(getKonnectOrganizationEscapeRoute).mockReset();
    stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const entryWith = async (appVersion: string, seen: boolean) => {
    vi.mocked(getAppVersion).mockReturnValue(appVersion);
    stubLocalStorage(seen ? { [HAS_SEEN_ONBOARDING_KEY]: 'true' } : {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    return getInitialEntry();
  };

  it('shows onboarding when unseen and app major.minor matches the onboarding version', async () => {
    expect(await entryWith(`${major}.${minor}.0`, false)).toBe(ONBOARDING_ROUTE);
  });

  it('shows onboarding for a patch or prerelease of the matching major.minor', async () => {
    expect(await entryWith(`${major}.${minor}.7`, false)).toBe(ONBOARDING_ROUTE);
    expect(await entryWith(`${major}.${minor}.0-beta.1`, false)).toBe(ONBOARDING_ROUTE);
  });

  it('skips onboarding when it has already been seen', async () => {
    expect(await entryWith(`${major}.${minor}.0`, true)).not.toBe(ONBOARDING_ROUTE);
  });

  it('skips onboarding when the minor version does not match', async () => {
    expect(await entryWith(`${major}.${minor + 1}.0`, false)).not.toBe(ONBOARDING_ROUTE);
  });

  it('skips onboarding when the major version does not match', async () => {
    expect(await entryWith(`${major + 1}.${minor}.0`, false)).not.toBe(ONBOARDING_ROUTE);
  });

  it('skips onboarding when the app version cannot be parsed', async () => {
    expect(await entryWith('not-a-version', false)).not.toBe(ONBOARDING_ROUTE);
  });
});
