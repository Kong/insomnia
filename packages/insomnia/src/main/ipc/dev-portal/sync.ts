import type { DevPortalAPIData } from 'insomnia-api';
import { getAPISpecByVersion, listDevPortalAPIs, listDevPortalAPISpecVersions } from 'insomnia-api';
import type {
  Environment,
  Request,
  RequestBody,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  Workspace,
} from 'insomnia-data';
import { database as db, EnvironmentType, models, services } from 'insomnia-data';

import { getDataFromKVPair, getKVPairFromData } from '~/common/utils/environment-utils';
import type { ImportRequest } from '~/main/importers/entities';
import { convert as convertOpenApi3 } from '~/main/importers/importers/openapi-3';
import { convert as convertSwagger2 } from '~/main/importers/importers/swagger-2';
import {
  type DevPortalFetchErrorDetails,
  handleDevPortalFetchError,
  throwDevPortalFetchError,
} from '~/main/ipc/dev-portal/dev-portal-fetch';

interface SyncCounts {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export function zeroCounts(): SyncCounts {
  return { total: 0, created: 0, updated: 0, deleted: 0, skipped: 0 };
}

export interface SkippedApiVersion {
  apiName: string;
  version: string;
  reason: string;
}

export interface DevPortalSyncResult {
  success: boolean;
  apis: SyncCounts;
  versions: SyncCounts;
  skippedVersions: SkippedApiVersion[];
  durationMs: number;
  error?: string;
  errorDetails?: DevPortalFetchErrorDetails;
}

interface SyncParams {
  devPortalUrl: string;
  accessToken: string;
  projectId: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

const stripIds = <T extends { id?: string }>(items: T[] = []): Omit<T, 'id'>[] =>
  items.map(({ id: _id, ...rest }) => rest);

const normalizeBody = (body?: ImportRequest['body']): RequestBody => {
  if (!body) {
    return {};
  }
  if (typeof body === 'string') {
    return { text: body };
  }
  return {
    mimeType: body.mimeType,
    text: body.text,
    params: body.params as RequestBody['params'],
  };
};

const buildRequestPatch = (item: ImportRequest, devPortalOperationId: string, includeBody: boolean) => {
  const patch: Partial<Request> = {
    name: item.name || 'New Request',
    method: (item.method || 'GET').toUpperCase(),
    url: item.url || '',
    description: item.description || '',
    headers: (item.headers as unknown as RequestHeader[]) || [],
    parameters: (item.parameters as unknown as RequestParameter[]) || [],
    authentication: item.authentication || {},
    devPortalOperationId,
  };
  if (includeBody) {
    patch.body = normalizeBody(item.body);
  }
  return patch;
};

const requestFieldsChanged = (existingRequest: Request, item: ImportRequest): boolean => {
  const patch = buildRequestPatch(item, existingRequest.devPortalOperationId || '', false);
  return (
    existingRequest.name !== patch.name ||
    existingRequest.method !== patch.method ||
    existingRequest.url !== patch.url ||
    existingRequest.description !== patch.description ||
    JSON.stringify(stripIds(existingRequest.headers)) !== JSON.stringify(stripIds(patch.headers as RequestHeader[])) ||
    JSON.stringify(stripIds(existingRequest.parameters)) !==
      JSON.stringify(stripIds(patch.parameters as RequestParameter[])) ||
    JSON.stringify(existingRequest.authentication || {}) !== JSON.stringify(patch.authentication || {})
  );
};

// Add sub-environment per server declared by a spec version, under the API workspace's shared base environment, named `${specVersion} server ${host}`
const syncVersionEnvironments = async (
  baseEnvironmentId: string,
  specVersion: string,
  resources: ImportRequest[],
): Promise<boolean> => {
  let changed = false;

  const importSubEnvs = resources.filter(r => r._type === 'environment' && r._id !== '__BASE_ENVIRONMENT_ID__');
  for (const importSubEnv of importSubEnvs) {
    const rawData = (importSubEnv.data as Record<string, any>) || {};
    const host = rawData.host;
    // Skip any sub-environments that don't have an _id or host, since we can't create a unique key for them without those.
    if (!importSubEnv._id || !host) {
      continue;
    }

    const environmentName = `${specVersion} server ${host}`;
    const kvPairData = getKVPairFromData(rawData, null);
    const { data, dataPropertyOrder } = getDataFromKVPair(kvPairData);

    const existingEnvironment = await services.environment.get({
      name: environmentName,
    });
    if (existingEnvironment) {
      if (JSON.stringify(existingEnvironment.data) !== JSON.stringify(data)) {
        await services.environment.update(existingEnvironment, {
          data,
          dataPropertyOrder,
          kvPairData,
          environmentType: EnvironmentType.KVPAIR,
        });
        changed = true;
      }
    } else {
      await services.environment.create({
        parentId: baseEnvironmentId,
        name: environmentName,
        data,
        kvPairData,
        dataPropertyOrder,
        environmentType: EnvironmentType.KVPAIR,
      });
      changed = true;
    }
  }

  return changed;
};

// Add/Update folders and requests based on the converted spec, and delete any stale requests or folders.
const syncVersionSpecContents = async (versionFolderId: string, resources: ImportRequest[]): Promise<boolean> => {
  let changed = false;

  const existingTagFolders = await db.find<RequestGroup>(models.requestGroup.type, { parentId: versionFolderId });
  const existingTagFolderByName = new Map(existingTagFolders.map(f => [f.name, f]));
  const allFolderIds = [versionFolderId, ...existingTagFolders.map(f => f._id)];
  const existingRequests = await db.find<Request>(models.request.type, { parentId: { $in: allFolderIds } });
  const existingRequestByOperationKey = new Map(
    existingRequests.filter(r => r.devPortalOperationId).map(r => [r.devPortalOperationId as string, r]),
  );
  const requestGroupsToImport = resources.filter(r => r._type === 'request_group');
  const requestsToImport = resources.filter(r => r._type === 'request');

  // Map the import request groups id with the actual request group id in the database
  const folderIdMap = new Map<string, string>();
  const importFolderNames = new Set<string>();
  for (const requestGroupToImport of requestGroupsToImport) {
    const name = requestGroupToImport.name || 'Folder';
    importFolderNames.add(name);
    const existingRequestGroup = existingTagFolderByName.get(name);
    let importRequestGroupId: string;
    if (existingRequestGroup) {
      importRequestGroupId = existingRequestGroup._id;
    } else {
      const newRequestGroup = await services.requestGroup.create({
        parentId: versionFolderId,
        name,
      });
      importRequestGroupId = newRequestGroup._id;
      changed = true;
    }
    if (requestGroupToImport._id) {
      folderIdMap.set(requestGroupToImport._id, importRequestGroupId);
    }
  }

  const incomingRequestOperationIds = new Set<string>();
  for (const requestToImport of requestsToImport) {
    const operationId = requestToImport.operationId!;
    incomingRequestOperationIds.add(operationId);
    const parentId = (requestToImport.parentId && folderIdMap.get(requestToImport.parentId)) || versionFolderId;
    const existingRequest = existingRequestByOperationKey.get(operationId);
    if (existingRequest) {
      if (requestFieldsChanged(existingRequest, requestToImport)) {
        await services.request.update(existingRequest, buildRequestPatch(requestToImport, operationId, false));
        changed = true;
      }
    } else {
      await services.request.create({ parentId, ...buildRequestPatch(requestToImport, operationId, true) });
      changed = true;
    }
  }

  // Delete stale/orphaned requests
  const staledRequests = existingRequests.filter(
    r => !r.devPortalOperationId || !incomingRequestOperationIds.has(r.devPortalOperationId),
  );
  for (const request of staledRequests) {
    await services.request.remove(request);
    changed = true;
  }

  // Delete tag folders no longer present by name, or left empty after the request deletion above.
  // const foldersWithChildren = new Set(
  //   (await db.find<Request>(models.request.type, { parentId: { $in: existingTagFolders.map(f => f._id) } })).map(
  //     r => r.parentId,
  //   ),
  // );
  for (const folder of existingTagFolders) {
    // if (!importFolderNames.has(folder.name) || !foldersWithChildren.has(folder._id)) {
    if (!importFolderNames.has(folder.name)) {
      await services.requestGroup.remove(folder);
      changed = true;
    }
  }

  return changed;
};

interface ApiVersionSyncResult {
  hasSyncableVersion: boolean;
  changed: boolean;
}

// Sync every spec version of a single API into its workspace except AsyncAPI type spec.
const syncApiVersions = async (
  api: DevPortalAPIData,
  workspace: Workspace,
  ctx: SyncParams,
  counts: { versions: SyncCounts; requests: SyncCounts },
  skippedVersions: SkippedApiVersion[],
): Promise<ApiVersionSyncResult> => {
  let apiSpecVersions: Awaited<ReturnType<typeof listDevPortalAPISpecVersions>> = [];
  try {
    apiSpecVersions = await listDevPortalAPISpecVersions({
      devPortalUrl: ctx.devPortalUrl,
      accessToken: ctx.accessToken,
      apiIdOrSlug: api.id,
    });
  } catch (err) {
    return await throwDevPortalFetchError(err, `fetch spec versions for API ${api.name} (${api.id})`);
  }
  const { name: apiName, id: apiId } = api;

  const existingFolders = (await services.requestGroup.findByParentId(workspace._id)).filter(
    f => f.devPortalVersionId != null,
  );
  const existingFolderByVersionId = new Map(
    existingFolders.map(folder => [folder.devPortalVersionId as string, folder]),
  );
  const incomingVersionIds = new Set<string>();
  let hasSyncableVersion = false;
  let changed = false;

  for (const apiSpecVersionData of apiSpecVersions) {
    ctx.signal?.throwIfAborted();
    const { id: apiSpecVersionId, version: apiSpecVersion } = apiSpecVersionData;
    incomingVersionIds.add(apiSpecVersionId);
    counts.versions.total++;

    if (apiSpecVersionData.spec.type === 'asyncapi') {
      // We do not support aysncapi specs yet
      counts.versions.skipped++;
      skippedVersions.push({ apiName, version: apiSpecVersion, reason: 'AsyncAPI specs are not supported' });
      continue;
    }
    hasSyncableVersion = true;

    const existingFolder = existingFolderByVersionId.get(apiSpecVersionId);
    let folder: RequestGroup;
    let folderChanged = false;
    let baseEnvironment: Environment | null = null;
    if (existingFolder) {
      if (existingFolder.name !== apiSpecVersion) {
        folder = await services.requestGroup.update(existingFolder, { name: apiSpecVersion });
        folderChanged = true;
      } else {
        folder = existingFolder;
      }
    } else {
      folder = await services.requestGroup.create({
        parentId: workspace._id,
        name: apiSpecVersion,
        devPortalVersionId: apiSpecVersionId,
      });
      counts.versions.created++;
      folderChanged = true;
    }

    ctx.onProgress?.(`Checking for updates from API ${api.name} spec version ${apiSpecVersion}...`);
    let specData: Awaited<ReturnType<typeof getAPISpecByVersion>>;
    try {
      specData = await getAPISpecByVersion(ctx.devPortalUrl, ctx.accessToken, apiId, apiSpecVersionId);
    } catch (error) {
      return await throwDevPortalFetchError(error, `fetch spec ${api.name} by version ${apiSpecVersion}`);
    }
    const convertFn = apiSpecVersionData.spec.type === 'oas2' ? convertSwagger2 : convertOpenApi3;
    const result = await convertFn(specData.spec.content);

    if (!result || 'convertErrorMessage' in result) {
      counts.versions.skipped++;
      skippedVersions.push({
        apiName: apiName,
        version: apiSpecVersion,
        reason: !result ? 'Unrecognized spec format' : result.convertErrorMessage,
      });
      continue;
    }

    // Create base environment from result;
    const baseEnvImportEntry = result.find(r => r._type === 'environment' && r._id === '__BASE_ENVIRONMENT_ID__');
    if (baseEnvImportEntry) {
      // One shared base environment per API workspace; every version's servers become sub-environments
      baseEnvironment = await services.environment.getOrCreateForParentId(workspace._id);
      await services.environment.update(baseEnvironment, {
        name: baseEnvImportEntry.name,
        data: baseEnvImportEntry.data,
        kvPairData: getKVPairFromData(baseEnvImportEntry.data as Record<string, any>, null),
        environmentType: EnvironmentType.KVPAIR,
      });
    }
    const contentChanged = await syncVersionSpecContents(folder._id, result);
    const envChanged = baseEnvironment
      ? await syncVersionEnvironments(baseEnvironment._id, apiSpecVersion, result)
      : false;

    if (folderChanged || contentChanged || envChanged) {
      changed = true;
      if (existingFolder) {
        counts.versions.updated++;
      }
    }
  }

  for (const folder of existingFolders) {
    if (!incomingVersionIds.has(folder.devPortalVersionId as string)) {
      await services.requestGroup.remove(folder);
      counts.versions.deleted++;
      changed = true;
    }
  }

  return { hasSyncableVersion, changed };
};

export async function syncDevPortal({
  devPortalUrl,
  accessToken,
  projectId,
  signal,
  onProgress,
}: SyncParams): Promise<DevPortalSyncResult> {
  const startTime = Date.now();
  const counts = { apis: zeroCounts(), versions: zeroCounts(), requests: zeroCounts() };
  const skippedVersions: SkippedApiVersion[] = [];
  const ctx: SyncParams = { devPortalUrl, accessToken, projectId, signal, onProgress };

  const bufferId = await db.bufferChangesIndefinitely();
  try {
    onProgress?.(`Checking for updates from ${devPortalUrl}...`);
    let devPortalApis: Awaited<ReturnType<typeof listDevPortalAPIs>> = [];
    try {
      devPortalApis = await listDevPortalAPIs({ devPortalUrl, accessToken });
    } catch (err) {
      return await throwDevPortalFetchError(err, `fetch Dev Portal APIs`);
    }

    const existingWorkspaces = (
      await services.workspace.list({ parentId: projectId, devPortalApiId: { $ne: null } })
    ).filter(w => w.devPortalApiId != null);
    const existingWorkspaceByApiId = new Map(existingWorkspaces.map(w => [w.devPortalApiId as string, w]));
    const incomingApiIds = new Set<string>();

    for (const api of devPortalApis) {
      const { name: apiName, description: apiDescription = '', id: apiId } = api;

      signal?.throwIfAborted();
      incomingApiIds.add(apiId);
      counts.apis.total++;
      onProgress?.(`Checking for updates from API ${apiName}...`);

      const existingWorkspace = existingWorkspaceByApiId.get(apiId);

      let workspace: Workspace;
      let isNewApi = false;
      let apiChanged = false;
      if (existingWorkspace) {
        if (existingWorkspace.name !== apiName || existingWorkspace.description !== apiDescription) {
          workspace = await services.workspace.update(existingWorkspace, {
            name: apiName,
            description: apiDescription,
          });
          apiChanged = true;
        } else {
          workspace = existingWorkspace;
        }
      } else {
        workspace = await services.workspace.create({
          parentId: projectId,
          name: apiName,
          description: apiDescription,
          scope: 'collection',
          devPortalApiId: apiId,
        });
        isNewApi = true;
      }

      const { hasSyncableVersion, changed: versionsChanged } = await syncApiVersions(
        api,
        workspace,
        ctx,
        counts,
        skippedVersions,
      );
      apiChanged = apiChanged || versionsChanged;

      if (!hasSyncableVersion) {
        // Nothing syncable was found for this API (e.g. every version is AsyncAPI) — report it
        // as skipped rather than created/modified, regardless of whether its (likely empty)
        // workspace is brand new or pre-existing.
        counts.apis.skipped++;
      } else if (isNewApi) {
        counts.apis.created++;
      } else if (apiChanged) {
        counts.apis.updated++;
      }
    }

    for (const [apiId, workspace] of existingWorkspaceByApiId) {
      if (!incomingApiIds.has(apiId)) {
        await services.workspace.remove(workspace);
        counts.apis.deleted++;
      }
    }

    return {
      success: true,
      apis: counts.apis,
      versions: counts.versions,
      skippedVersions,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const { name, message, status, statusText, body } = handleDevPortalFetchError(err);
    return {
      success: false,
      apis: counts.apis,
      versions: counts.versions,
      skippedVersions,
      durationMs: Date.now() - startTime,
      errorDetails: {
        name,
        message,
        status,
        statusText,
        body,
      },
    };
  } finally {
    await db.flushChanges(bufferId);
  }
}
