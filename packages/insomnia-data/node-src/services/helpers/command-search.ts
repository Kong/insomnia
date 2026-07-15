import type {
  CommandSearchResult,
  Environment,
  GrpcRequest,
  Request,
  RequestGroup,
  WebSocketRequest,
  Workspace,
} from 'insomnia-data';
import { database, models } from 'insomnia-data';
import { fuzzyMatch } from 'insomnia-data/common';

import * as environmentService from '../environment';
import * as projectService from '../project';
import * as workspaceService from '../workspace';

const activeSearchControllers = new Map<string, AbortController>();

export async function commandSearch(params: {
  allOrganizations: { id: string; name: string }[];
  organizationId: string;
  projectId: string;
  workspaceId?: string | null;
  filter?: string | null;
  requestId: string;
}): Promise<CommandSearchResult> {
  console.log('[command-search]', 'search', params.requestId, {
    allOrganizations: params.allOrganizations.length,
    organizationId: params.organizationId,
    projectId: params.projectId,
    workspaceId: params.workspaceId,
    filter: params.filter,
  });

  const controller = new AbortController();
  activeSearchControllers.set(params.requestId, controller);
  const { signal } = controller;

  const abortable = <T>(promise: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Search aborted', 'AbortError'));
        return;
      }
      const onAbort = () => reject(new DOMException('Search aborted', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(
        value => {
          signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        err => {
          signal.removeEventListener('abort', onAbort);
          reject(err);
        },
      );
    });

  const { allOrganizations, organizationId, projectId, workspaceId, filter, requestId } = params;

  try {
    const requestFilter = (req: Request | WebSocketRequest | GrpcRequest) => {
      if (!filter) {
        return true;
      }
      return Boolean(
        fuzzyMatch(filter, [req.name, req.url, req.description].join(' '), { splitSpace: false, loose: true })?.indexes,
      );
    };

    const fileFilter = (ws: Workspace) => {
      if (!filter) {
        return true;
      }
      return Boolean(
        fuzzyMatch(filter, [ws.name, ws.description].join(' '), { splitSpace: false, loose: true })?.indexes,
      );
    };

    const allOrganizationsIds = models.organization.isScratchpadOrganizationId(organizationId)
      ? [organizationId]
      : allOrganizations.map(org => org.id);

    const allProjects = await abortable(
      projectService.list({
        parentId: allOrganizationsIds.length === 1 ? allOrganizationsIds[0] : { $in: allOrganizationsIds },
      }),
    );

    const allProjectIds = allProjects.map(p => p._id);

    const allOrganizationWorkspaces = await abortable(
      workspaceService.list({
        parentId: { $in: allProjectIds },
      }),
    );

    const workspaceIds = allOrganizationWorkspaces.map(ws => ws._id);

    const parentReferences = new Map<
      string,
      {
        type: 'Project' | 'Workspace' | 'RequestGroup' | 'Request' | 'GrpcRequest' | 'WebSocketRequest';
        organizationId: string;
        projectId?: string;
        workspaceId?: string;
      }
    >();

    allProjects.forEach(p => {
      parentReferences.set(p._id, {
        type: 'Project',
        organizationId: p.parentId,
        projectId: p._id,
      });
    });

    const safeParent = (id: string) => parentReferences.get(id);

    allOrganizationWorkspaces.forEach(ws => {
      const parent = safeParent(ws.parentId);
      if (!parent) return;
      parentReferences.set(ws._id, {
        type: 'Workspace',
        organizationId: parent.organizationId,
        projectId: ws.parentId,
        workspaceId: ws._id,
      });
    });

    const getRequestGroups = async ({ $in }: { $in: string[] }, depth = 0): Promise<RequestGroup[]> => {
      if (depth > 20 || signal.aborted) return [];

      const requestGroups = await abortable(
        database.find<RequestGroup>(models.requestGroup.type, {
          parentId: { $in },
        }),
      );

      for (const rg of requestGroups) {
        const parent = safeParent(rg.parentId);
        if (!parent) continue;
        parentReferences.set(rg._id, {
          type: 'RequestGroup',
          organizationId: parent.organizationId,
          projectId: parent.projectId,
          workspaceId: parent.workspaceId,
        });
      }

      const requestGroupIds = requestGroups.map(rg => rg._id);

      const childRequestGroups =
        requestGroupIds.length > 0 ? await getRequestGroups({ $in: requestGroupIds }, depth + 1) : [];

      for (const rg of childRequestGroups) {
        const parent = safeParent(rg.parentId);
        if (!parent) continue;
        parentReferences.set(rg._id, {
          type: 'RequestGroup',
          organizationId: parent.organizationId,
          projectId: parent.projectId,
          workspaceId: parent.workspaceId,
        });
      }

      await new Promise<void>(r => setImmediate(r));

      return [...requestGroups, ...childRequestGroups];
    };

    const allRequestGroups = await abortable(getRequestGroups({ $in: workspaceIds }));

    const allRequestGroupIds = allRequestGroups.map(rg => rg._id);
    const requestParentIds = [...workspaceIds, ...allRequestGroupIds];

    const requests = await abortable(
      database.find<Request>(models.request.type, {
        parentId: { $in: requestParentIds },
      }),
    );

    for (const req of requests) {
      const parent = safeParent(req.parentId);
      if (!parent) continue;
      parentReferences.set(req._id, {
        type: 'Request',
        organizationId: parent.organizationId,
        projectId: parent.projectId,
        workspaceId: parent.workspaceId,
      });
    }

    const grpcRequests = await abortable(
      database.find<GrpcRequest>(models.grpcRequest.type, {
        parentId: { $in: requestParentIds },
      }),
    );

    for (const grpcReq of grpcRequests) {
      const parent = safeParent(grpcReq.parentId);
      if (!parent) continue;
      parentReferences.set(grpcReq._id, {
        type: 'GrpcRequest',
        organizationId: parent.organizationId,
        projectId: parent.projectId,
        workspaceId: parent.workspaceId,
      });
    }

    const webSocketRequests = await abortable(
      database.find<WebSocketRequest>(models.webSocketRequest.type, {
        parentId: { $in: requestParentIds },
      }),
    );

    for (const wsReq of webSocketRequests) {
      const parent = safeParent(wsReq.parentId);
      if (!parent) continue;
      parentReferences.set(wsReq._id, {
        type: 'WebSocketRequest',
        organizationId: parent.organizationId,
        projectId: parent.projectId,
        workspaceId: parent.workspaceId,
      });
    }

    const allRequests = [...requests, ...grpcRequests, ...webSocketRequests];

    let environments: Environment[] = [];
    if (workspaceId) {
      const baseEnvironment = await abortable(environmentService.getByParentId(workspaceId));

      if (baseEnvironment) {
        const subEnvironments = await abortable(environmentService.listByParentId(baseEnvironment._id));

        environments = [baseEnvironment, ...subEnvironments];
      }
    }

    const currentRequests = allRequests.filter(req => safeParent(req.parentId)?.workspaceId === workspaceId);
    const otherRequests = allRequests.filter(req => safeParent(req.parentId)?.workspaceId !== workspaceId);

    const currentFiles = allOrganizationWorkspaces.filter(ws => ws.parentId === projectId);
    const otherFiles = allOrganizationWorkspaces.filter(ws => ws.parentId !== projectId);

    const environmentFilter = (env: Environment) => {
      if (!filter) return true;
      return Boolean(fuzzyMatch(filter, env.name, { splitSpace: false, loose: true })?.indexes);
    };

    const mapRequest = (item: Request | GrpcRequest | WebSocketRequest) => {
      const orgId = parentReferences.get(item.parentId)?.organizationId || '';
      const projId = parentReferences.get(item.parentId)?.projectId || '';
      const wsId = parentReferences.get(item.parentId)?.workspaceId || '';
      return {
        id: item._id,
        url: `/organization/${orgId}/project/${projId}/workspace/${wsId}/debug/request/${item._id}`,
        name: item.name,
        item,
        organizationName: allOrganizations.find(org => org.id === orgId)?.name || '',
        projectName: allProjects.find(p => p._id === projId)?.name || '',
        workspaceName: allOrganizationWorkspaces.find(ws => ws._id === wsId)?.name || '',
        organizationId: orgId,
        projectId: projId,
        workspaceId: wsId,
      };
    };

    const mapFile = (ws: Workspace) => {
      const orgId = parentReferences.get(ws.parentId)?.organizationId || '';
      const projId = parentReferences.get(ws.parentId)?.projectId || '';
      const parentProject = allProjects.find(p => p._id === ws.parentId);
      return {
        id: ws._id,
        url: `/organization/${orgId}/project/${projId}/workspace/${ws._id}/${models.workspace.scopeToActivity(ws.scope)}`,
        name: ws.name,
        item: {
          ...ws,
          teamProjectId: parentProject && models.project.isRemoteProject(parentProject) ? parentProject.remoteId : '',
        },
        organizationName: allOrganizations.find(org => org.id === orgId)?.name || '',
        projectName: allProjects.find(p => p._id === projId)?.name || '',
        organizationId: orgId,
        projectId: projId,
      };
    };

    const res = {
      requestId,
      current: {
        requests: currentRequests.filter(requestFilter).slice(0, 100).map(mapRequest),
        files: currentFiles.filter(fileFilter).slice(0, 100).map(mapFile),
        environments: environments.filter(environmentFilter).slice(0, 100),
      },
      other: {
        requests: otherRequests.filter(requestFilter).slice(0, 100).map(mapRequest),
        files: otherFiles.filter(fileFilter).slice(0, 100).map(mapFile),
      },
    };

    console.log('[command-search]', 'search', params.requestId, 'result', {
      current: {
        requests: res.current.requests.length,
        files: res.current.files.length,
        environments: res.current.environments.length,
      },
      other: {
        requests: res.other.requests.length,
        files: res.other.files.length,
      },
    });

    return res;
  } finally {
    activeSearchControllers.delete(params.requestId);
  }
}

export async function abortCommandSearch(requestId: string): Promise<void> {
  const controller = activeSearchControllers.get(requestId);
  console.log('[command-search]', 'abort', requestId, controller ? 'controller' : 'no controller');
  if (controller) {
    controller.abort();
    activeSearchControllers.delete(requestId);
  }
}
