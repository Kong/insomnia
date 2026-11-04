import type * as InsomniaApi from 'insomnia-api';
import type * as InsomniaData from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('insomnia-data', async importOriginal => {
  const actual = await importOriginal<typeof InsomniaData>();
  return {
    ...actual,
    services: {
      ...actual.services,
      userSession: { ...actual.services.userSession, get: vi.fn() },
      organization: { ...actual.services.organization, list: vi.fn() },
    },
  };
});
vi.mock('insomnia-api', async importOriginal => ({
  ...(await importOriginal<typeof InsomniaApi>()),
  getUserProfile: vi.fn(async () => ({ id: 'user_1' })),
  getCurrentPlan: vi.fn(async () => ({ planId: 'plan_1' })),
}));
vi.mock('~/konnect/migrate-konnect-organization', () => ({ migrateKonnectProjectsIfUnambiguous: vi.fn() }));
vi.mock('~/ui/account/session', () => ({ logout: vi.fn() }));
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

import { accountServerDataKey } from '~/common/organization';
import { migrateKonnectProjectsIfUnambiguous } from '~/konnect/migrate-konnect-organization';
import { logout } from '~/ui/account/session';
import { serverQueryClient } from '~/ui/context/app/server-data-context';
import {
  getKonnectOrganizationEscapeRoute,
  migrateProjectsUnderOrganization,
  refreshKonnectAccess,
} from '~/ui/organization-utils';
import { getInitialRouteForOrganization } from '~/ui/utils/router';

import { enterOrganization, prepareAccount, resolveLandingRoute, resolveOrganizationLandingRoute } from './landing-route';

const ACCOUNT_ID = 'acct_1';
const ORGANIZATION_ID = 'org_1';
const OTHER_ORGANIZATION_ID = 'org_2';
const KONNECT_ORGANIZATION_ID = models.organization.getKonnectOrganizationId(ACCOUNT_ID);
const SPACES_KEY = `${ACCOUNT_ID}:spaces`;
const ORGANIZATIONS = [{ id: ORGANIZATION_ID }, { id: OTHER_ORGANIZATION_ID }] as InsomniaApi.Organization[];
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
    vi.mocked(services.organization.list).mockResolvedValue(ORGANIZATIONS);
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS });
  });

  afterEach(() => {
    serverQueryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses the persisted organization list without fetching it', async () => {
    await prepareAccount(sessionId, ACCOUNT_ID);

    expect(services.organization.list).not.toHaveBeenCalled();
    expect(serverQueryClient.getQueryData(accountServerDataKey(ACCOUNT_ID))).toMatchObject({
      organizations: ORGANIZATIONS,
    });
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledWith('org_target', sessionId);
  });

  it('fetches the organization list when none is persisted, writing it through', async () => {
    stubLocalStorage({});

    await prepareAccount(sessionId, ACCOUNT_ID);

    expect(services.organization.list).toHaveBeenCalledTimes(1);
    expect(store.get(SPACES_KEY)).toBe(CACHED_ORGANIZATIONS);
    expect(migrateProjectsUnderOrganization).toHaveBeenCalled();
  });

  it('fails when no organization list can be fetched, after the client retries, and tries again on the next call', async () => {
    vi.useFakeTimers();
    stubLocalStorage({});
    vi.mocked(services.organization.list).mockRejectedValue(new Error('offline'));

    const expectFailure = async () => {
      const result = expect(prepareAccount(sessionId, ACCOUNT_ID)).rejects.toThrow('offline');
      await vi.runAllTimersAsync();
      await result;
    };
    await expectFailure();
    // The server client's default `retry: 2`.
    expect(services.organization.list).toHaveBeenCalledTimes(3);
    await expectFailure();
    expect(services.organization.list).toHaveBeenCalledTimes(6);
    vi.useRealTimers();
  });

  it('runs the Konnect migration, then Konnect access, then the project migration', async () => {
    const order: string[] = [];
    vi.mocked(migrateKonnectProjectsIfUnambiguous).mockImplementation(async () => {
      order.push('konnect');
      return { status: 'none', groups: [] };
    });
    vi.mocked(refreshKonnectAccess).mockImplementation(async () => void order.push('konnect-access'));
    vi.mocked(migrateProjectsUnderOrganization).mockImplementation(async () => void order.push('projects'));

    await prepareAccount(sessionId, ACCOUNT_ID);

    expect(order).toEqual(['konnect', 'konnect-access', 'projects']);
  });

  it('does not let a failing step block the others or the landing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(migrateKonnectProjectsIfUnambiguous).mockRejectedValueOnce(new Error('konnect'));
    vi.mocked(refreshKonnectAccess).mockRejectedValueOnce(new Error('access'));
    vi.mocked(migrateProjectsUnderOrganization).mockRejectedValueOnce(new Error('projects'));

    await expect(prepareAccount(sessionId, ACCOUNT_ID)).resolves.toBeUndefined();
    expect(migrateProjectsUnderOrganization).toHaveBeenCalled();
  });

  it('runs once per session, including concurrent calls', async () => {
    await Promise.all([prepareAccount(sessionId, ACCOUNT_ID), prepareAccount(sessionId, ACCOUNT_ID)]);
    await prepareAccount(sessionId, ACCOUNT_ID);
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(1);

    await prepareAccount(`${sessionId}_next`, ACCOUNT_ID);
    expect(migrateProjectsUnderOrganization).toHaveBeenCalledTimes(2);
  });

});

describe('enterOrganization', () => {
  let sessionCount = 0;

  beforeEach(() => {
    vi.mocked(services.organization.list).mockResolvedValue(ORGANIZATIONS);
    stubLocalStorage({ [SPACES_KEY]: CACHED_ORGANIZATIONS });
  });

  afterEach(() => {
    serverQueryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('prepares the account when signed in', async () => {
    const sessionId = `sess_enter_${++sessionCount}`;
    vi.mocked(services.userSession.get).mockResolvedValue({ id: sessionId, accountId: ACCOUNT_ID } as any);

    await enterOrganization(ORGANIZATION_ID);

    expect(migrateProjectsUnderOrganization).toHaveBeenCalledWith('org_target', sessionId);
    expect(logout).not.toHaveBeenCalled();
  });

  it('lets a signed-out user into the scratchpad without preparing anything', async () => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: '', accountId: '' } as any);

    await enterOrganization(models.organization.SCRATCHPAD_ORGANIZATION_ID);

    expect(logout).not.toHaveBeenCalled();
    expect(services.organization.list).not.toHaveBeenCalled();
    expect(migrateProjectsUnderOrganization).not.toHaveBeenCalled();
  });

  it.each([ORGANIZATION_ID, undefined])('sends a signed-out user to the login page (organization %s)', async id => {
    vi.mocked(services.userSession.get).mockResolvedValue({ id: '', accountId: '' } as any);

    const error = await enterOrganization(id).catch(error_ => error_);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).headers.get('Location')).toBe('/auth/login');
    expect(migrateProjectsUnderOrganization).not.toHaveBeenCalled();
  });
});

describe('resolveLandingRoute', () => {
  beforeEach(() => {
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(null);
    serverQueryClient.setQueryData(accountServerDataKey(ACCOUNT_ID), { organizations: ORGANIZATIONS });
    stubLocalStorage({});
  });

  afterEach(() => {
    serverQueryClient.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('reads the loaded organization list, not the persisted one', async () => {
    // e.g. localStorage cleared mid-session
    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${ORGANIZATION_ID}/project?workspace`);
  });

  it('lands in the first organization, restoring its last workspace', async () => {
    const route = await resolveLandingRoute(ACCOUNT_ID);

    expect(route).toBe(`/organization/${ORGANIZATION_ID}/project?workspace`);
  });

  it('restores the last visited organization when it is known', async () => {
    stubLocalStorage({ lastVisitedOrganizationId: OTHER_ORGANIZATION_ID });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${OTHER_ORGANIZATION_ID}/project?workspace`);
  });

  it('ignores a last visited organization that is no longer in the list', async () => {
    stubLocalStorage({ lastVisitedOrganizationId: 'org_gone' });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${ORGANIZATION_ID}/project?workspace`);
  });

  it('escapes to a real organization when the last-visited Konnect organization is no longer visible', async () => {
    stubLocalStorage({ lastVisitedOrganizationId: KONNECT_ORGANIZATION_ID });
    vi.mocked(getKonnectOrganizationEscapeRoute).mockResolvedValue(`/organization/${ORGANIZATION_ID}`);

    const route = await resolveLandingRoute(ACCOUNT_ID);

    expect(getKonnectOrganizationEscapeRoute).toHaveBeenCalledWith(KONNECT_ORGANIZATION_ID);
    expect(route).toBe(`/organization/${ORGANIZATION_ID}`);
    // Must not have tried to resolve a route *inside* the now-invisible organization.
    expect(getInitialRouteForOrganization).not.toHaveBeenCalled();
  });

  it('still restores the Konnect organization when it remains visible', async () => {
    stubLocalStorage({ lastVisitedOrganizationId: KONNECT_ORGANIZATION_ID });

    expect(await resolveLandingRoute(ACCOUNT_ID)).toBe(`/organization/${KONNECT_ORGANIZATION_ID}/project?workspace`);
  });

  it('prefers the organization requested before signing in, once', async () => {
    stubLocalStorage({
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
