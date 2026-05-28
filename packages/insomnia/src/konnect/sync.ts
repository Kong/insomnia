import type { GrpcRequest, Project, Request, RequestGroup, WebSocketRequest, Workspace } from '~/insomnia-data';
import { EnvironmentKvPairDataType, models, services as insoservices } from '~/insomnia-data';

import { database as db } from '../common/database';
import {
  fetchAllControlPlanes,
  fetchAllServices,
  fetchRoutesForService,
  type KonnectControlPlane,
  type KonnectRoute,
  type KonnectService,
} from './api';
import { applyExpressionFields } from './expression-parser';
import {
  buildRequestName,
  deriveProxyVarDefaults,
  extractRegionFromEndpoint,
  KONNECT_PROXY_VAR_NAMES,
  konnectHeadersChanged,
  mergeHeaders,
  mergePathParameters,
  pathParametersChanged,
  resolvePath,
  routeDisplayName,
  sanitizeRoute,
} from './transform';

interface SyncCounts {
  total: number;
  created: number;
  updated: number;
  deleted: number;
  skipped: number;
}

export interface SkippedRoute {
  routeName: string;
  reason: string;
  serviceName: string;
}

export interface SyncResult {
  success: boolean;
  controlPlanes: SyncCounts;
  services: SyncCounts;
  routes: SyncCounts;
  skippedRoutes: SkippedRoute[];
  durationMs: number;
  error?: string;
}

interface SyncParams {
  pat: string;
  organizationId: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

/** Invariants that are constant for the lifetime of a single Control Plane sync pass. */
interface ServiceSyncContext {
  pat: string;
  controlPlane: KonnectControlPlane;
  project: Project;
  region: string;
  globalEnvironmentId: string;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

export function zeroCounts(): SyncCounts {
  return { total: 0, created: 0, updated: 0, deleted: 0, skipped: 0 };
}

function mergeCounts(target: SyncCounts, source: SyncCounts): void {
  target.total += source.total;
  target.created += source.created;
  target.updated += source.updated;
  target.deleted += source.deleted;
  target.skipped += source.skipped;
}

/** Finds or creates a RequestGroup folder. For route-level folders, omit `name` match. */
async function upsertFolder(parentId: string, name: string, konnectRouteId: string): Promise<string> {
  const existing = (await db.find<RequestGroup>(models.requestGroup.type, { parentId, konnectRouteId, name }))[0];
  return existing?._id ?? (await insoservices.requestGroup.create({ parentId, name, konnectRouteId }))._id;
}

/** Finds or creates a route-level folder (matched by konnectRouteId only, not name — name may change). */
async function upsertRouteFolder(parentId: string, name: string, konnectRouteId: string): Promise<string> {
  const existing = (await db.find<RequestGroup>(models.requestGroup.type, { parentId, konnectRouteId }))[0];
  if (existing) {
    if (existing.name !== name) {
      await insoservices.requestGroup.update(existing, { name });
    }
    return existing._id;
  }
  return (await insoservices.requestGroup.create({ parentId, name, konnectRouteId }))._id;
}

const L4_PROTOCOLS = new Set(['tcp', 'tls', 'udp', 'tls_passthrough']);

interface ExistingRequestMaps {
  http: Map<string, Request>;
  ws: Map<string, WebSocketRequest>;
  grpc: Map<string, GrpcRequest>;
}

interface ExistingRequestData {
  maps: ExistingRequestMaps;
  parentIds: string[];
  folders: RequestGroup[];
}

async function loadExistingRequestData(workspaceId: string): Promise<ExistingRequestData> {
  // Include requests up to 2 levels deep (workspace → route folders → path×protocol sub-folders).
  const topFolders = await db.find<RequestGroup>(models.requestGroup.type, { parentId: workspaceId });
  const subFolders =
    topFolders.length > 0
      ? await db.find<RequestGroup>(models.requestGroup.type, { parentId: { $in: topFolders.map(f => f._id) } })
      : [];
  const allFolders = [...topFolders, ...subFolders];
  const parentIds = [workspaceId, ...allFolders.map(f => f._id)];
  const query = { parentId: { $in: parentIds }, konnectRouteKey: { $ne: null } };
  const httpDocs = (await db.find<Request>(models.request.type, query)).filter(r => r.konnectRouteKey != null);
  const wsDocs = (await db.find<WebSocketRequest>(models.webSocketRequest.type, query)).filter(
    r => r.konnectRouteKey != null,
  );
  const grpcDocs = (await db.find<GrpcRequest>(models.grpcRequest.type, query)).filter(r => r.konnectRouteKey != null);
  return {
    maps: {
      http: new Map(httpDocs.map(r => [r.konnectRouteKey!, r])),
      ws: new Map(wsDocs.map(r => [r.konnectRouteKey!, r])),
      grpc: new Map(grpcDocs.map(r => [r.konnectRouteKey!, r])),
    },
    parentIds,
    folders: allFolders,
  };
}

async function syncGrpcRoute(
  route: KonnectRoute,
  workspaceId: string,
  existingByKey: Map<string, GrpcRequest>,
  routeCounts: SyncCounts,
  incomingKeys: Set<string>,
): Promise<void> {
  const grpcProtocols = route.protocols.filter(p => p === 'grpc' || p === 'grpcs') as ('grpc' | 'grpcs')[];
  const multiProtocol = grpcProtocols.length > 1;
  const paths = route.paths ?? [null];
  const metadata = Object.entries(route.headers ?? {}).map(([n, values]: [string, string[]]) => ({
    name: n.toLowerCase(),
    value: values[0],
  }));

  const routeFolderId = await upsertRouteFolder(workspaceId, routeDisplayName(route), route.id);

  for (const rawPath of paths) {
    const protoMethodName = resolvePath(rawPath).path;
    const baseName = protoMethodName || routeDisplayName(route);

    for (const protocol of grpcProtocols) {
      let parentId = routeFolderId;
      if (multiProtocol) {
        const subFolderName = `${protocol.toUpperCase()} ${baseName}`;
        parentId = await upsertFolder(routeFolderId, subFolderName, route.id);
      }

      const pathSegment = rawPath ?? '';
      const key = `${route.id}:grpc:${pathSegment}:${protocol}`;
      incomingKeys.add(key);
      routeCounts.total++;

      const proxyHostVar = protocol === 'grpcs' ? '_.grpcs_proxy_host' : '_.grpc_proxy_host';
      const url = `${protocol}://{{ ${proxyHostVar} }}`;
      const name = baseName;
      const existing = existingByKey.get(key);

      const konnectManagedHeaderNames = metadata.map(h => h.name);
      if (existing) {
        const merged = mergeHeaders(existing.metadata ?? [], metadata, existing.konnectManagedHeaderNames ?? []);
        if (
          existing.url !== url ||
          existing.name !== name ||
          existing.protoMethodName !== protoMethodName ||
          konnectHeadersChanged(existing.metadata ?? [], metadata, existing.konnectManagedHeaderNames ?? [])
        ) {
          await insoservices.grpcRequest.update(existing, {
            url,
            name,
            protoMethodName,
            metadata: merged,
            konnectManagedHeaderNames,
          });
          routeCounts.updated++;
        }
      } else {
        await insoservices.grpcRequest.create({
          parentId,
          url,
          name,
          protoMethodName,
          metadata,
          konnectRouteKey: key,
          konnectManagedHeaderNames,
        });
        routeCounts.created++;
      }
    }
  }
}

async function syncWsRoute(
  route: KonnectRoute,
  workspaceId: string,
  headers: { name: string; value: string }[],
  existingByKey: Map<string, WebSocketRequest>,
  routeCounts: SyncCounts,
  incomingKeys: Set<string>,
): Promise<void> {
  const wsProtocols = route.protocols.filter(p => p === 'ws' || p === 'wss') as ('ws' | 'wss')[];
  const multiProtocol = wsProtocols.length > 1;
  const paths = route.paths ?? [null];

  const routeFolderId = await upsertRouteFolder(workspaceId, routeDisplayName(route), route.id);

  for (const rawPath of paths) {
    const { path, pathParameters } = resolvePath(rawPath);
    const baseName = buildRequestName({ ...route, paths: rawPath !== null ? [rawPath] : null });

    for (const protocol of wsProtocols) {
      let parentId = routeFolderId;
      if (multiProtocol) {
        const subFolderName = `${protocol.toUpperCase()} ${baseName}`;
        parentId = await upsertFolder(routeFolderId, subFolderName, route.id);
      }

      const pathSegment = rawPath ?? '';
      const key = `${route.id}:ws:${pathSegment}:${protocol}`;
      incomingKeys.add(key);
      routeCounts.total++;

      const url = `${protocol}://{{ _.proxy_host }}${path}`;
      const name = baseName;
      const existing = existingByKey.get(key);

      const konnectManagedHeaderNames = headers.map(h => h.name);
      if (existing) {
        const merged = mergeHeaders(existing.headers ?? [], headers, existing.konnectManagedHeaderNames ?? []);
        const mergedPathParams = mergePathParameters(existing.pathParameters ?? [], pathParameters);
        if (
          existing.url !== url ||
          existing.name !== name ||
          konnectHeadersChanged(existing.headers ?? [], headers, existing.konnectManagedHeaderNames ?? []) ||
          pathParametersChanged(existing.pathParameters ?? [], pathParameters)
        ) {
          await insoservices.webSocketRequest.update(existing, {
            url,
            name,
            headers: merged,
            pathParameters: mergedPathParams,
            konnectManagedHeaderNames,
          });
          routeCounts.updated++;
        }
      } else {
        await insoservices.webSocketRequest.create({
          parentId,
          url,
          name,
          headers,
          pathParameters,
          konnectRouteKey: key,
          konnectManagedHeaderNames,
        });
        routeCounts.created++;
      }
    }
  }
}

async function syncHttpRoute(
  route: KonnectRoute,
  workspaceId: string,
  headers: { name: string; value: string }[],
  existingByKey: Map<string, Request>,
  routeCounts: SyncCounts,
  incomingKeys: Set<string>,
): Promise<void> {
  const methods = route.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  const paths = route.paths ?? [null];
  const httpProtocols = route.protocols.filter(p => p === 'http' || p === 'https') as ('http' | 'https')[];
  const multiProtocol = httpProtocols.length > 1;
  const needsSubFolders = multiProtocol || paths.length > 1;

  const routeFolderId = await upsertRouteFolder(workspaceId, routeDisplayName(route), route.id);

  for (const routePath of paths) {
    const { path: resolvedPath, pathParameters } = resolvePath(routePath);
    const pathSegment = routePath ?? '';
    const baseName = buildRequestName({ ...route, paths: routePath !== null ? [routePath] : null });

    for (const protocol of httpProtocols) {
      let parentId = routeFolderId;
      if (needsSubFolders) {
        const subFolderName = multiProtocol ? `${protocol.toUpperCase()} ${baseName}` : baseName;
        parentId = await upsertFolder(routeFolderId, subFolderName, route.id);
      }

      for (const method of methods) {
        const key = `${route.id}:${method}:${pathSegment}:${protocol}`;
        incomingKeys.add(key);
        routeCounts.total++;

        const url = `${protocol}://{{ _.proxy_host }}${resolvedPath}`;
        const name = baseName;
        const existing = existingByKey.get(key);

        const konnectManagedHeaderNames = headers.map(h => h.name);
        if (existing) {
          const merged = mergeHeaders(existing.headers ?? [], headers, existing.konnectManagedHeaderNames ?? []);
          const mergedPathParams = mergePathParameters(existing.pathParameters ?? [], pathParameters);
          if (
            existing.method !== method ||
            existing.url !== url ||
            existing.name !== name ||
            konnectHeadersChanged(existing.headers ?? [], headers, existing.konnectManagedHeaderNames ?? []) ||
            pathParametersChanged(existing.pathParameters ?? [], pathParameters)
          ) {
            await insoservices.request.update(existing, {
              method,
              url,
              name,
              headers: merged,
              pathParameters: mergedPathParams,
              konnectManagedHeaderNames,
            });
            routeCounts.updated++;
          }
        } else {
          await insoservices.request.create({
            parentId,
            method,
            url,
            name,
            headers,
            pathParameters,
            konnectRouteKey: key,
            konnectManagedHeaderNames,
          });
          routeCounts.created++;
        }
      }
    }
  }
}

/**
 * Deletes stale konnect-managed requests (route removed from Konnect) and
 * any user-added requests (no konnectRouteKey) found in the workspace.
 */
async function deleteStaleRequests(
  existingData: ExistingRequestData,
  incomingKeys: Set<string>,
  incomingRouteIds: Set<string>,
  routeCounts: SyncCounts,
): Promise<void> {
  // Delete konnect-managed requests whose key no longer matches an incoming route
  const stale: (() => Promise<void>)[] = [
    ...[...existingData.maps.http.values()]
      .filter(r => !incomingKeys.has(r.konnectRouteKey!))
      .map(r => () => insoservices.request.remove(r)),
    ...[...existingData.maps.ws.values()]
      .filter(r => !incomingKeys.has(r.konnectRouteKey!))
      .map(r => () => insoservices.webSocketRequest.remove(r)),
    ...[...existingData.maps.grpc.values()]
      .filter(r => !incomingKeys.has(r.konnectRouteKey!))
      .map(r => () => insoservices.grpcRequest.remove(r)),
  ];

  // Delete user-added requests (no konnectRouteKey) that live in the workspace or its folders.
  const noKeyQuery = {
    parentId: { $in: existingData.parentIds },
    $or: [{ konnectRouteKey: null }, { konnectRouteKey: { $exists: false } }],
  };
  const userHttp = await db.find<Request>(models.request.type, noKeyQuery);
  const userWs = await db.find<WebSocketRequest>(models.webSocketRequest.type, noKeyQuery);
  const userGrpc = await db.find<GrpcRequest>(models.grpcRequest.type, noKeyQuery);
  stale.push(
    ...userHttp.map(r => () => insoservices.request.remove(r)),
    ...userWs.map(r => () => insoservices.webSocketRequest.remove(r)),
    ...userGrpc.map(r => () => insoservices.grpcRequest.remove(r)),
  );

  for (const remove of stale) {
    await remove();
    routeCounts.deleted++;
  }

  // Delete orphaned folders (route removed from Konnect) and empty sub-folders
  // (path/protocol renamed — requests were already deleted above, leaving the sub-folder empty).
  const folderIds = existingData.folders.map(f => f._id);
  const foldersWithChildren = new Set<string>([
    ...(await db.find<Request>(models.request.type, { parentId: { $in: folderIds } })).map(r => r.parentId),
    ...(await db.find<WebSocketRequest>(models.webSocketRequest.type, { parentId: { $in: folderIds } })).map(
      r => r.parentId,
    ),
    ...(await db.find<GrpcRequest>(models.grpcRequest.type, { parentId: { $in: folderIds } })).map(r => r.parentId),
    ...(await db.find<RequestGroup>(models.requestGroup.type, { parentId: { $in: folderIds } })).map(f => f.parentId),
  ]);
  for (const folder of existingData.folders) {
    if (!folder.konnectRouteId) {
      continue;
    }
    if (!incomingRouteIds.has(folder.konnectRouteId) || !foldersWithChildren.has(folder._id)) {
      await insoservices.requestGroup.remove(folder);
    }
  }
}

async function syncServiceWorkspace(
  ctx: ServiceSyncContext,
  service: KonnectService,
  existingWorkspace: Workspace | undefined,
  counts: { services: SyncCounts; routes: SyncCounts },
  skippedRoutes: SkippedRoute[],
): Promise<void> {
  const { pat, controlPlane, project, region, globalEnvironmentId, signal, onProgress } = ctx;

  const serviceName = service.name ?? `Gateway Service ${service.id}`;

  // Upsert workspace for this service
  let workspace: Workspace;
  if (existingWorkspace) {
    if (existingWorkspace.name !== serviceName) {
      workspace = await insoservices.workspace.update(existingWorkspace, { name: serviceName });
      counts.services.updated++;
    } else {
      workspace = existingWorkspace;
    }
  } else {
    workspace = await insoservices.workspace.create({
      parentId: project._id,
      name: serviceName,
      scope: 'collection',
      konnectServiceId: service.id,
    });
    counts.services.created++;
  }
  counts.services.total++;

  // Set project-level env as the active global env for this workspace
  const workspaceMeta = await insoservices.workspaceMeta.getOrCreateByParentId(workspace._id);
  if (workspaceMeta.activeGlobalEnvironmentId !== globalEnvironmentId) {
    await insoservices.workspaceMeta.update(workspaceMeta, { activeGlobalEnvironmentId: globalEnvironmentId });
  }
  await insoservices.cookieJar.getOrCreateForParentId(workspace._id);

  const incomingRoutes = (await fetchRoutesForService(pat, controlPlane.id, service.id, region, signal)).map(
    sanitizeRoute,
  );
  const existingData = await loadExistingRequestData(workspace._id);
  const incomingKeys = new Set<string>();
  const incomingRouteIds = new Set<string>();

  for (const route of incomingRoutes) {
    signal?.throwIfAborted();
    incomingRouteIds.add(route.id);

    const expressionResult = applyExpressionFields(route);
    if (!expressionResult.syncable) {
      counts.routes.skipped++;
      skippedRoutes.push({ routeName: expressionResult.routeName, reason: expressionResult.reason, serviceName });
      continue;
    }
    const effectiveRoute = expressionResult.route;

    const isL4 = effectiveRoute.protocols.every(p => L4_PROTOCOLS.has(p));
    const isGrpc = effectiveRoute.protocols.some(p => p === 'grpc' || p === 'grpcs');
    const isWs = effectiveRoute.protocols.some(p => p === 'ws' || p === 'wss');

    const routeName = routeDisplayName(effectiveRoute);

    if (isL4) {
      counts.routes.skipped++;
      skippedRoutes.push({
        routeName,
        reason: `Unsupported protocol: ${effectiveRoute.protocols.join(', ')}`,
        serviceName,
      });
      continue;
    }

    // Routes matched by SNI cannot be represented — Insomnia derives SNI implicitly
    // from the URL hostname and has no SNI override.
    // Note: expression-router tls.sni is caught earlier in applyExpressionFields;
    // this check covers the traditional router's snis field.
    if ((effectiveRoute.snis?.length ?? 0) > 0) {
      counts.routes.skipped++;
      skippedRoutes.push({ routeName, reason: 'Route uses SNI matching — unsupported in Insomnia', serviceName });
      continue;
    }

    if (isGrpc) {
      await syncGrpcRoute(effectiveRoute, workspace._id, existingData.maps.grpc, counts.routes, incomingKeys);
    } else {
      // Host header only applies to HTTP/WS — gRPC uses :authority which Insomnia derives from the URL
      const headers = [
        ...(effectiveRoute.hosts?.[0] ? [{ name: 'host', value: effectiveRoute.hosts[0] }] : []),
        ...Object.entries(effectiveRoute.headers ?? {}).map(([name, values]) => ({
          name: name.toLowerCase(),
          value: values[0],
        })),
      ];
      await (isWs
        ? syncWsRoute(effectiveRoute, workspace._id, headers, existingData.maps.ws, counts.routes, incomingKeys)
        : syncHttpRoute(effectiveRoute, workspace._id, headers, existingData.maps.http, counts.routes, incomingKeys));
    }
  }

  await deleteStaleRequests(existingData, incomingKeys, incomingRouteIds, counts.routes);
  onProgress?.(`Synced ${serviceName} in ${controlPlane.name}`);
}

/** Upserts the project-level environment workspace and syncs Konnect proxy URL vars into it. Returns the environment id. */
async function upsertProjectEnvVars(controlPlane: KonnectControlPlane, project: Project): Promise<string> {
  const existingEnvWorkspaces = await db.find<Workspace>(models.workspace.type, {
    parentId: project._id,
    scope: 'environment',
  });
  const envWorkspace =
    existingEnvWorkspaces.length > 0
      ? existingEnvWorkspaces[0]
      : await insoservices.workspace.create({
          parentId: project._id,
          name: `${controlPlane.name} Environment`,
          scope: 'environment',
        });

  const projectEnv = await insoservices.environment.getOrCreateForParentId(envWorkspace._id);
  const existingKvPairs = projectEnv.kvPairData ?? [];
  const existingByName = new Map(existingKvPairs.map(kv => [kv.name, kv]));
  const proxyDefaults = deriveProxyVarDefaults(controlPlane.proxy_urls);
  const newKvPairs = [...KONNECT_PROXY_VAR_NAMES]
    .filter(name => !existingByName.has(name))
    .map(name => ({
      id: `env_${name}`,
      name,
      value: proxyDefaults[name] ?? '',
      type: EnvironmentKvPairDataType.STRING,
      enabled: true,
    }));

  // For existing vars that are still empty, fill in from proxy_urls if available
  const updatedExisting = existingKvPairs.map(kv => {
    if (kv.value === '' && (KONNECT_PROXY_VAR_NAMES as readonly string[]).includes(kv.name)) {
      const defaultValue = proxyDefaults[kv.name as (typeof KONNECT_PROXY_VAR_NAMES)[number]];
      if (defaultValue) {
        return { ...kv, value: defaultValue };
      }
    }
    return kv;
  });

  if (newKvPairs.length > 0 || updatedExisting.some((kv, i) => kv !== existingKvPairs[i])) {
    await insoservices.environment.update(projectEnv, {
      kvPairData: [...updatedExisting, ...newKvPairs],
    });
  }

  return projectEnv._id;
}

interface ControlPlaneSyncAccumulators {
  controlPlaneCounts: SyncCounts;
  serviceCounts: SyncCounts;
  routeCounts: SyncCounts;
  skippedRoutes: SkippedRoute[];
}

interface SyncContext {
  pat: string;
  organizationId: string;
  existingProjectsByKonnectId: Map<string, Project>;
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
}

/** Syncs a single control plane: upserts its project + env, syncs all services, deletes stale workspaces. */
async function syncControlPlane(
  controlPlane: KonnectControlPlane,
  syncCtx: SyncContext,
  acc: ControlPlaneSyncAccumulators,
): Promise<void> {
  const { pat, organizationId, existingProjectsByKonnectId, signal, onProgress } = syncCtx;
  acc.controlPlaneCounts.total++;
  const region = extractRegionFromEndpoint(controlPlane.config.control_plane_endpoint);

  // Upsert project for this control plane
  let project = existingProjectsByKonnectId.get(controlPlane.id);
  if (project) {
    if (project.name !== controlPlane.name || project.konnectClusterType !== controlPlane.config.cluster_type) {
      project = await insoservices.project.update(project, {
        name: controlPlane.name,
        konnectClusterType: controlPlane.config.cluster_type,
      });
      acc.controlPlaneCounts.updated++;
    }
  } else {
    project = await insoservices.project.create({
      parentId: organizationId,
      name: controlPlane.name,
      konnectControlPlaneId: controlPlane.id,
      konnectClusterType: controlPlane.config.cluster_type,
    });
    existingProjectsByKonnectId.set(controlPlane.id, project);
    acc.controlPlaneCounts.created++;
  }

  const globalEnvironmentId = await upsertProjectEnvVars(controlPlane, project);

  onProgress?.(`Fetching services for ${controlPlane.name}...`);
  const services = await fetchAllServices(pat, controlPlane.id, region, signal);

  // Load existing Konnect workspaces for this project once, keyed by service id
  const existingWorkspaces = (
    await db.find<Workspace>(models.workspace.type, {
      parentId: project._id,
      konnectServiceId: { $ne: null },
    })
  ).filter(w => w.konnectServiceId != null);
  const existingWorkspaceByServiceId = new Map(existingWorkspaces.map(w => [w.konnectServiceId!, w]));
  const incomingServiceIds = new Set(services.map(s => s.id));

  const ctx: ServiceSyncContext = { pat, controlPlane, project, region, globalEnvironmentId, signal, onProgress };
  const CONCURRENCY = 5;
  const bufferId = await db.bufferChanges();
  try {
    for (let i = 0; i < services.length; i += CONCURRENCY) {
      signal?.throwIfAborted();
      const batch = services.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async service => {
          const localCounts = { services: zeroCounts(), routes: zeroCounts() };
          const localSkipped: SkippedRoute[] = [];
          await syncServiceWorkspace(
            ctx,
            service,
            existingWorkspaceByServiceId.get(service.id),
            localCounts,
            localSkipped,
          );
          return { counts: localCounts, skipped: localSkipped };
        }),
      );
      for (const { counts, skipped } of batchResults) {
        mergeCounts(acc.serviceCounts, counts.services);
        mergeCounts(acc.routeCounts, counts.routes);
        acc.skippedRoutes.push(...skipped);
      }
    }

    // Delete stale workspaces (services removed from this Control Plane)
    for (const workspace of existingWorkspaces) {
      if (!incomingServiceIds.has(workspace.konnectServiceId!)) {
        await insoservices.workspace.remove(workspace);
        acc.serviceCounts.deleted++;
      }
    }
  } finally {
    await db.flushChanges(bufferId);
  }
}

export async function syncKonnect({ pat, organizationId, signal, onProgress }: SyncParams): Promise<SyncResult> {
  const startTime = Date.now();
  const acc: ControlPlaneSyncAccumulators = {
    controlPlaneCounts: zeroCounts(),
    serviceCounts: zeroCounts(),
    routeCounts: zeroCounts(),
    skippedRoutes: [],
  };

  try {
    // Load all existing Konnect projects up front to avoid per Control Plane queries
    const existingProjects = (
      await db.find<Project>(models.project.type, {
        parentId: organizationId,
        konnectControlPlaneId: { $ne: null },
      })
    ).filter(p => p.konnectControlPlaneId != null);
    const existingProjectsByKonnectId = new Map(existingProjects.map(p => [p.konnectControlPlaneId!, p]));
    const incomingControlPlaneIds = new Set<string>();
    const syncCtx: SyncContext = { pat, organizationId, existingProjectsByKonnectId, signal, onProgress };

    for await (const controlPlanePage of fetchAllControlPlanes(pat, signal)) {
      for (const controlPlane of controlPlanePage) {
        incomingControlPlaneIds.add(controlPlane.id);
        await syncControlPlane(controlPlane, syncCtx, acc);
      }
    }

    // Delete stale projects (Control Planes removed from Konnect)
    for (const [controlPlaneId, project] of existingProjectsByKonnectId) {
      if (!incomingControlPlaneIds.has(controlPlaneId)) {
        await insoservices.project.remove(project);
        acc.controlPlaneCounts.deleted++;
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      controlPlanes: acc.controlPlaneCounts,
      services: acc.serviceCounts,
      routes: acc.routeCounts,
      skippedRoutes: acc.skippedRoutes,
      durationMs,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    return {
      success: false,
      controlPlanes: acc.controlPlaneCounts,
      services: acc.serviceCounts,
      routes: acc.routeCounts,
      skippedRoutes: acc.skippedRoutes,
      durationMs,
      error: errorMessage,
    };
  }
}
