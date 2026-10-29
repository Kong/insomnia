import type { Organization } from 'insomnia-api';
import type * as InsomniaData from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaData>();
  return {
    ...actual,
    services: { ...actual.services, userSession: { ...actual.services.userSession, get: vi.fn() } },
  };
});
vi.mock('~/common/organization', () => ({ syncOrganizations: vi.fn() }));
vi.mock('~/konnect/migrate-konnect-organization', () => ({ migrateKonnectProjectsIfUnambiguous: vi.fn() }));
vi.mock('~/ui/organization-utils', () => ({
  findMigrationTargetSpaceId: vi.fn(() => 'org_target'),
  getKonnectOrganizationEscapeRoute: vi.fn(),
  migrateProjectsUnderOrganization: vi.fn(),
  refreshKonnectAccess: vi.fn(),
}));
vi.mock('~/ui/utils/router', () => ({
  getInitialRouteForOrganization: vi.fn(
    async ({ organizationId, navigateToWorkspace }: { organizationId: string; navigateToWorkspace: boolean }) =>
      `/organization/${organizationId}/project${navigateToWorkspace ? '?workspace' : ''}`,
  ),
}));

import { models, services } from 'insomnia-data';

import { syncOrganizations } from '~/common/organization';
import { migrateKonnectProjectsIfUnambiguous } from '~/konnect/migrate-konnect-organization';
import {
  getKonnectOrganizationEscapeRoute,
  migrateProjectsUnderOrganization,
  refreshKonnectAccess,
} from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/ui/utils/router';

import { prepareAccount, resolveLandingRoute, resolveOrganizationLandingRoute } from './landing-route';

const ACCOUNT_ID = 'acct_1';
const ORGANIZATION_ID = 'org_1';
const OTHER_ORGANIZATION_ID = 'org_2';
const KONNECT_ORGANIZATION_ID = models.organization.getKonnectOrganizationId(ACCOUNT_ID);
const SPACES_KEY = `${ACCOUNT_ID}:spaces`;
const ORGANIZATIONS = [{ id: ORGANIZATION_ID }, { id: OTHER_ORGANIZATION_ID }] as Organization[];
const CACHED_ORGANIZATIONS = JSON.stringify(ORGANIZATIONS);

let store: Map<string, string>;

function stubLocalStorage(initial: Record<string, string>) {
  store = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };
  // Some keys are read via bare `localStorage` and others via `window.localStorage`.
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', { localStorage: storage });
}

describe('prepareAccount', () => {
  // The preparation is kept per session for the module's lifetime, so every test signs in anew.
  let sessionCount = 0;
  let sessionId: string;

  beforeEach(() => {
    sessionId = `sess_${++sessionCount}`;
    vi.mocked(services.userSession.get).mockResolvedValue({ id: sessionId, accountId: ACCOUNT_ID } as any);
    vi.mocked(syncOrganizations).mockReset();
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the persisted organization list without fetching it', async () => {
    await prepareAccount();

    expect(syncOrganizations).not.toHaveBeenCalled();
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledWith('org_target', sessionId);
  });

  it('fetches the organization list when none is persisted', async () => {
    stubLocalStorage({});
    vi.mocked(syncOrganizations).mockImplementation(async () => {
      store.set(SPACES_KEY, CACHED_ORGANIZATIONS);
    });

    await prepareAccount();

    expect(syncOrganizations).toHaveBeenCalledWith(sessionId, ACCOUNT_ID);
    expect(migrateProjectsUnderOrganization).toHaveBeenCalled();
  });

  it('fails when no organization list can be fetched, and tries again on the next call', async () => {
    stubLocalStorage({});

    await expect(prepareAccount()).rejects.toThrow('Failed to fetch organizations');
    await expect(prepareAccount()).rejects.toThrow('Failed to fetch organizations');
    expect(syncOrganizations).toHaveBeenCalledTimes(2);
  });

  it('runs the Konnect migration, then Konnect access, then the project migration', async () => {
    const order: string[] = [];
    vi.mocked(migrateKonnectProjectsIfUnambiguous).mockImplementation(async () => {
      order.push('konnect');
      return { status: 'none', groups: [] };
    });
    vi.mocked(refreshKonnectAccess).mockImplementation(async () => void order.push('konnect-access'));
    vi.mocked(migrateProjectsUnderOrganization).mockImplementation(async () => void order.push('projects'));

    await prepareAccount();

    expect(order).toEqual(['konnect', 'konnect-access', 'projects']);
  });

  it('does not let a failing step block the others or the landing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(migrateKonnectProjectsIfUnambiguous).mockRejectedValueOnce(new Error('konnect'));
    vi.mocked(refreshKonnectAccess).mockRejectedValueOnce(new Error('access'));
    vi.mocked(migrateProjectsUnderOrganization).mockRejectedValueOnce(new Error('projects'));

    await expect(prepareAccount()).resolves.toBeUndefined();
    expect(migrateProjectsUnderOrganization).toHaveBeenCalled();
  });

  it('runs once per session, including concurrent calls', async () => {
    await Promise.all([prepareAccount(), prepareAccount()]);
    await prepareAccount();
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(1);

    vi.mocked(services.userSession.get).mockResolvedValue({ id: `${sessionId}_next`, accountId: ACCOUNT_ID } as any);
    await prepareAccount();
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(2);
  });

  it('does nothing when logged out', async () => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: '', accountId: '' } as any);

    await prepareAccount();

    expect(syncOrganizations).not.toHaveBeenCalled();
    expect(migrateKonnectProjectsIfUnambiguous).not.toHaveBeenCalled();
    expect(migrateProjectsUnderOrganization).not.toHaveBeenCalled();
  });
});

describe('resolveLandingRoute', () => {
  beforeEach(() => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(null);
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('lands in the first organization, restoring its last workspace', async () => {
    const route = await resolveLandingRoute(ACCOUNT_ID);

    expect(route).toBe(`/organization/${ORGANIZATION_ID}/project?workspace`);
  });

  it('restores the last visited organization when it is known', async () => {
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS, lastVisitedOrganizationId: OTHER_ORGANIZATION_ID });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${OTHER_ORGANIZATION_ID}/project?workspace`);
  });

  it('ignores a last visited organization that is no longer in the list', async () => {
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS, lastVisitedOrganizationId: 'org_gone' });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${ORGANIZATION_ID}/project?workspace`);
  });

  it('escapes to a real organization when the last-visited Konnect organization is no longer visible', async () => {
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS, lastVisitedOrganizationId: KONNECT_ORGANIZATION_ID });
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(`/organization/${ORGANIZATION_ID}`);

    const route = await resolveLandingRoute(ACCOUNT_ID);

    expect(getKonnectOrganizationEscapeRoute).toHaveBeenCalledWith(KONNECT_ORGANIZATION_ID);
    expect(route).toBe(`/organization/${ORGANIZATION_ID}`);
    // Must not have tried to resolve a route *inside* the now-invisible organization.
    expect(getInitialRouteForOrganization).not.toHaveBeenCalled();
  });

  it('still restores the Konnect organization when it remains visible', async () => {
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS, lastVisitedOrganizationId: KONNECT_ORGANIZATION_ID });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${KONNECT_ORGANIZATION_ID}/project?workspace`);
  });

  it('prefers the organization requested before signing in, once', async () => {
    stubLocalStorage({
      [SPACES_KEY]: CACHED_ORGANIZATIONS,
      lastVisitedOrganizationId: ORGANIZATION_ID,
      specificOrgRedirectAfterAuthorize: OTHER_ORGANIZATION_ID,
    });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${OTHER_ORGANIZATION_ID}/project`);
    expect(store.has('specificOrgRedirectAfterAuthorize')).toBe(false);
  });
});

describe('resolveOrganizationLandingRoute', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lands on a project of the organization from local data', async () => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(null);

    expect(await resolveOrganizationLandingRoute(ORGANIZATION_ID)).toBe(`/organization/${ORGANIZATION_ID}/project`);
    expect(getInitialRouteForOrganization).toHaveBeenCalledWith({
      organizationId: ORGANIZATION_ID,
      navigateToWorkspace: false,
    });
  });

  it('escapes an organization that just became invisible', async () => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(`/organization/${ORGANIZATION_ID}`);

    expect(await resolveOrganizationLandingRoute(KONNECT_ORGANIZATION_ID)).toBe(`/organization/${ORGANIZATION_ID}`);
    expect(getInitialRouteForOrganization).not.toHaveBeenCalled();
  });
});
