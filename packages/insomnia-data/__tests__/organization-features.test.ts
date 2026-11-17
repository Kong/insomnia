import { configureFetch, type FeatureList, type FetchConfig } from 'insomnia-api';
import { database as db, services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The organization service is already loaded by the test setup (via servicesNodeImpl), so a
// vi.mock of insomnia-api would not reach it. Inject the API client's fetch instead.
const getOrganizationFeaturesMock = vi.fn();
configureFetch((options: FetchConfig) => getOrganizationFeaturesMock(options) as Promise<any>);

const ORG_ID = 'org_remote';

const featuresWithHide = (enabled: boolean) =>
  ({ hideSecretValuesInPreviewAndConsole: { enabled } }) as unknown as FeatureList;

beforeEach(async () => {
  await db.init({ inMemoryOnly: true }, true);
  await services.organization.clearFeaturesCache();
  getOrganizationFeaturesMock.mockReset();
  getOrganizationFeaturesMock.mockResolvedValue({ features: featuresWithHide(true), billing: {} });
  await services.userSession.update({ id: 'session_1' });
});

describe('services.organization.getFeatures', () => {
  it('skips the API for missing, local-only organizations and logged-out users', async () => {
    expect(await services.organization.getFeatures('')).toBeNull();
    expect(await services.organization.getFeatures('org_scratchpad')).toBeNull();

    await services.userSession.update({ id: '' });
    expect(await services.organization.getFeatures(ORG_ID)).toBeNull();

    expect(getOrganizationFeaturesMock).not.toHaveBeenCalled();
  });

  it('caches per session and dedupes concurrent requests', async () => {
    const [a, b] = await Promise.all([services.organization.getFeatures(ORG_ID), services.organization.getFeatures(ORG_ID)]);
    expect(a).toEqual(featuresWithHide(true));
    expect(b).toBe(a);
    await services.organization.getFeatures(ORG_ID);
    expect(getOrganizationFeaturesMock).toHaveBeenCalledTimes(1);

    // A different session must not see the previous session's cached features.
    await services.userSession.update({ id: 'session_2' });
    await services.organization.getFeatures(ORG_ID);
    expect(getOrganizationFeaturesMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last known value when a refetch fails', async () => {
    await services.organization.getFeatures(ORG_ID);
    getOrganizationFeaturesMock.mockRejectedValueOnce(new Error('offline'));

    expect(await services.organization.getFeatures(ORG_ID, { forceFetch: true })).toEqual(featuresWithHide(true));
  });

  it('serves set features without fetching', async () => {
    await services.organization.setFeatures(ORG_ID, featuresWithHide(false));

    expect(await services.organization.getFeatures(ORG_ID)).toEqual(featuresWithHide(false));
    expect(getOrganizationFeaturesMock).not.toHaveBeenCalled();
  });

  it('asynchronously drops expired entries of other organizations', async () => {
    await services.organization.setFeatures('org_other', featuresWithHide(false));

    const dateNow = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000 + 1);
    try {
      await services.organization.getFeatures(ORG_ID);
      // Let the scheduled sweep run.
      await new Promise(resolve => setTimeout(resolve, 0));

      // The expired entry is gone, so a failed refetch has no last known value to fall back to.
      getOrganizationFeaturesMock.mockRejectedValueOnce(new Error('offline'));
      expect(await services.organization.getFeatures('org_other')).toBeNull();
    } finally {
      dateNow.mockRestore();
    }
  });
});

describe('services.organization.resolveHideSecretValuesForOrg', () => {
  it('returns true without fetching when the user setting hides', async () => {
    expect(
      await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings: { hideSecretValuesInPreviewAndConsole: true } }),
    ).toBe(true);
    expect(await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings: {} })).toBe(true);
    expect(getOrganizationFeaturesMock).not.toHaveBeenCalled();
  });

  it('ORs the user setting with the organization enforcement', async () => {
    const settings = { hideSecretValuesInPreviewAndConsole: false };
    expect(await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings })).toBe(true);

    await services.organization.clearFeaturesCache();
    getOrganizationFeaturesMock.mockResolvedValue({ features: featuresWithHide(false), billing: {} });
    expect(await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings })).toBe(false);

    // Older API versions do not return the flag at all.
    await services.organization.clearFeaturesCache();
    getOrganizationFeaturesMock.mockResolvedValue({ features: {}, billing: {} });
    expect(await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings })).toBe(false);
  });

  it('falls back to the user setting when the features are unavailable', async () => {
    getOrganizationFeaturesMock.mockRejectedValue(new Error('offline'));
    expect(
      await services.organization.resolveHideSecretValuesForOrg({ organizationId: ORG_ID, settings: { hideSecretValuesInPreviewAndConsole: false } }),
    ).toBe(false);
  });
});

describe('services.organization.resolveHideSecretValues', () => {
  it('resolves the organization through the project of a nested request', async () => {
    const project = await services.project.create({ _id: 'proj_1', name: 'Project', parentId: ORG_ID });
    const workspace = await services.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace',
      parentId: project._id,
      scope: 'collection',
    });
    const folder = await services.requestGroup.create({ _id: 'fld_1', parentId: workspace._id });
    const request = await services.request.create({ _id: 'req_1', parentId: folder._id });
    // e.g. the synthetic OAuth 2 token request, which is parented to a request
    const child = { ...request, _id: 'req_child', parentId: request._id };

    expect(await services.organization.getOrgIdForDoc(request)).toBe(ORG_ID);
    expect(await services.organization.getOrgIdForDoc(child)).toBe(ORG_ID);
    expect(await services.organization.resolveHideSecretValues(child, { hideSecretValuesInPreviewAndConsole: false })).toBe(true);
    expect(getOrganizationFeaturesMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: `/v1/organizations/${ORG_ID}/features`, sessionId: 'session_1' }),
    );
  });
});
