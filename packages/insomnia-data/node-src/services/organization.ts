import { type FeatureList, getOrganizationFeatures, getSpaces, type Organization } from 'insomnia-api';
import { type BaseModel, database as db, models } from 'insomnia-data';

import * as userSessionService from './user-session';

function sortOrganizations(organizations: Organization[]): Organization[] {
  const owned = organizations
    .filter(organization => organization.is_owner)
    .sort((a, b) => a.name.localeCompare(b.name));
  const notOwned = organizations
    .filter(organization => !organization.is_owner)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...owned, ...notOwned];
}

/**
 * List organizations (spaces) from the Insomnia cloud API.
 */
export async function list(): Promise<Organization[]> {
  const { id: sessionId, accountId } = await userSessionService.get();

  if (!sessionId || !accountId) {
    return [];
  }

  const organizations = await getSpaces({ sessionId });

  return sortOrganizations(organizations);
}

/**
 * Get a single organization by ID.
 */
export async function get(id: string): Promise<Organization | undefined> {
  const all = await list();
  return all.find(org => org.id === id);
}

// Organization features fetched from the Insomnia API, cached in memory by the services implementation.
// Only the main process (and Inso) run this implementation; the renderer and plugin window reach it
// through the services IPC proxy, so every window shares this one cache.
//
// The cache is keyed by session + organization so that a logout or account switch never
// serves the previous account's features: no session id means no lookup at all.

const FEATURES_CACHE_TTL_MS = 10 * 60 * 1000;

interface FeaturesCacheEntry {
  features: FeatureList;
  fetchedAt: number;
}

const featuresCache = new Map<string, FeaturesCacheEntry>();
const featuresInFlight = new Map<string, Promise<FeatureList | null>>();

const getFeaturesCacheKey = (sessionId: string, organizationId: string) => `${sessionId}:${organizationId}`;

let lastFeaturesSweepAt = 0;

/**
 * Drops expired entries (other organizations, a previous session) without blocking the caller.
 * Runs at most once per TTL, since getFeatures is on the hot render path.
 */
function scheduleExpiredFeaturesSweep(keepKey?: string) {
  const now = Date.now();
  if (now - lastFeaturesSweepAt < FEATURES_CACHE_TTL_MS) {
    return;
  }
  lastFeaturesSweepAt = now;
  setTimeout(() => {
    const expiredBefore = Date.now() - FEATURES_CACHE_TTL_MS;
    for (const [key, entry] of featuresCache) {
      // The key being read keeps its stale entry as the fallback for a failed refetch.
      if (key !== keepKey && entry.fetchedAt < expiredBefore) {
        featuresCache.delete(key);
      }
    }
  }, 0);
}

/**
 * Returns the organization's feature list, or null when there is nothing to look up
 * (no organization, a local-only organization, or no logged-in session).
 *
 * A failed fetch returns the last known value for this session + organization, so a
 * transient network error does not silently drop an organization-enforced setting.
 */
export async function getFeatures(
  organizationId: string | undefined,
  { forceFetch = false }: { forceFetch?: boolean } = {},
): Promise<FeatureList | null> {
  if (!organizationId || models.organization.isLocalOrganizationId(organizationId)) {
    return null;
  }

  const { id: sessionId } = await userSessionService.get();
  if (!sessionId) {
    scheduleExpiredFeaturesSweep();
    return null;
  }

  const key = getFeaturesCacheKey(sessionId, organizationId);
  scheduleExpiredFeaturesSweep(key);
  const cached = featuresCache.get(key);
  if (!forceFetch && cached && Date.now() - cached.fetchedAt < FEATURES_CACHE_TTL_MS) {
    return cached.features;
  }

  // Renders run concurrently (every editor/tag preview), so share one request per key.
  const pending = featuresInFlight.get(key);
  if (pending) {
    return pending;
  }

  // Wrapped so a synchronous throw from the API client is handled like a rejected fetch.
  const request = Promise.resolve()
    .then(() => getOrganizationFeatures({ organizationId, sessionId }))
    .then(
      res => {
        if (res?.features) {
          featuresCache.set(key, { features: res.features, fetchedAt: Date.now() });
          return res.features;
        }
        return cached?.features ?? null;
      },
      err => {
        console.log('[organizationFeatures] Failed to load organization features', err?.message);
        return cached?.features ?? null;
      },
    )
    .finally(() => {
      featuresInFlight.delete(key);
    });

  featuresInFlight.set(key, request);
  return request;
}

/** Seeds the cache with features already fetched elsewhere (e.g. the renderer's query cache). */
export async function setFeatures(organizationId: string, features: FeatureList) {
  const { id: sessionId } = await userSessionService.get();
  if (!sessionId || models.organization.isLocalOrganizationId(organizationId)) {
    return;
  }
  featuresCache.set(getFeaturesCacheKey(sessionId, organizationId), { features, fetchedAt: Date.now() });
}

export async function clearFeaturesCache() {
  featuresCache.clear();
  featuresInFlight.clear();
  lastFeaturesSweepAt = 0;
}

/**
 * Effective "hide confidential values" setting: the user's preference OR the organization's
 * enforcement. Never write this back to settings — settings are global and the user's own,
 * while enforcement is per organization.
 */
export async function resolveHideSecretValues({
  organizationId,
  settings,
}: {
  organizationId: string | undefined;
  settings: { hideSecretValuesInPreviewAndConsole?: boolean };
}): Promise<boolean> {
  // The user preference defaults to true, so most renders never need the network.
  if (settings.hideSecretValuesInPreviewAndConsole ?? true) {
    return true;
  }
  return models.organization.isHideSecretValuesEnforcedByOrganization(await getFeatures(organizationId));
}

/** The organization a request/folder/workspace belongs to, via its project's parentId. */
export async function getOrgIdForDoc(doc: BaseModel): Promise<string | undefined> {
  if (models.project.isProject(doc)) {
    return doc.parentId;
  }
  // Request types are included for docs whose parent is a request, e.g. the synthetic
  // OAuth 2 token request in get-token.ts, which is parented to the request it authenticates.
  const ancestors = await db.withAncestors<BaseModel>(doc, [
    models.requestGroup.type,
    models.workspace.type,
    models.project.type,
    models.request.type,
    models.grpcRequest.type,
    models.webSocketRequest.type,
    models.socketIORequest.type,
    models.mcpRequest.type,
    models.mockRoute.type,
    models.mockServer.type,
  ]);
  return ancestors.find(models.project.isProject)?.parentId;
}

/** {@link resolveHideSecretValues} for a doc, skipping the ancestor lookup when the user preference already hides. */
export async function resolveHideSecretValuesForDoc(
  doc: BaseModel,
  settings: { hideSecretValuesInPreviewAndConsole?: boolean },
): Promise<boolean> {
  if (settings.hideSecretValuesInPreviewAndConsole ?? true) {
    return true;
  }
  const orgId = await getOrgIdForDoc(doc);
  if (!orgId) {
    return true;
  }
  return resolveHideSecretValues({ organizationId: orgId, settings });
}
