import type { Organization } from 'insomnia-api';

import { database } from '~/common/database';
import { fuzzyMatch } from '~/common/misc';
import type { Environment, GrpcRequest, Project, WebSocketRequest, Workspace } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { environment, grpcRequest, project, request, requestGroup, workspace } from '~/models';
import { isScratchpadOrganizationId } from '~/models/organization';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import { invariant } from '~/utils/invariant';
import { createFetcherLoadHook } from '~/utils/router';

import type { Route } from './+types/commands';

export async function clientLoader(args: Route.ClientLoaderArgs) {
  const searchParams = new URL(args.request.url).searchParams;
  const organizationId = searchParams.get('organizationId');
  invariant(organizationId, 'organizationId is required');
  const projectId = searchParams.get('projectId');
  invariant(projectId, 'projectId is required');
  const workspaceId = searchParams.get('workspaceId');
  const filter = searchParams.get('filter');
  const requestFilter = (request: Request | WebSocketRequest | GrpcRequest) => {
    if (!filter) {
      return true;
    }
    return Boolean(
      fuzzyMatch(filter || '', [request.name, request.url, request.description].join(' '), {
        splitSpace: false,
        loose: true,
      })?.indexes,
    );
  };

  const { accountId } = await services.userSession.getOrCreate();

  const allOrganizations = JSON.parse(localStorage.getItem(`${accountId}:organizations`) || '[]') as Organization[];

  const allOrganizationsIds = isScratchpadOrganizationId(organizationId)
    ? [organizationId]
    : allOrganizations.map(org => org.id);

  const allProjects = await database.find<Project>(project.type, {
    parentId: { $in: allOrganizationsIds },
  });

  const allProjectIds = allProjects.map(project => project._id);

  const allOrganizationWorkspaces = await database.find<Workspace>(workspace.type, {
    parentId: { $in: allProjectIds },
  });

  const workspaceIds = allOrganizationWorkspaces.map(workspace => workspace._id);

  const parentReferences = new Map<
    string,
    {
      type: 'Project' | 'Workspace' | 'RequestGroup' | 'Request' | 'GrpcRequest' | 'WebSocketRequest';
      organizationId: string;
      projectId?: string;
      workspaceId?: string;
    }
  >();

  allProjects.forEach(project => {
    parentReferences.set(project._id, {
      type: 'Project',
      organizationId: project.parentId,
      projectId: project._id,
    });
  });

  allOrganizationWorkspaces.forEach(workspaceId => {
    parentReferences.set(workspaceId._id, {
      type: 'Workspace',
      organizationId: parentReferences.get(workspaceId.parentId)!.organizationId,
      projectId: workspaceId.parentId,
      workspaceId: workspaceId._id,
    });
  });

  const getRequestGroups = async ({ $in }: { $in: string[]; root?: boolean }): Promise<RequestGroup[]> => {
    const requestGroups = await database.find<RequestGroup>(requestGroup.type, {
      parentId: {
        $in,
      },
    });

    for (const requestGroup of requestGroups) {
      parentReferences.set(requestGroup._id, {
        type: 'RequestGroup',
        organizationId: parentReferences.get(requestGroup.parentId)!.organizationId,
        projectId: parentReferences.get(requestGroup.parentId)!.projectId,
        workspaceId: parentReferences.get(requestGroup.parentId)!.workspaceId,
      });
    }

    const requestGroupIds = requestGroups.map(requestGroup => requestGroup._id);

    const childRequestGroups =
      requestGroupIds.length > 0
        ? await getRequestGroups({
            $in: requestGroupIds,
          })
        : [];

    for (const requestGroup of childRequestGroups) {
      parentReferences.set(requestGroup._id, {
        type: 'RequestGroup',
        organizationId: parentReferences.get(requestGroup.parentId)!.organizationId,
        projectId: parentReferences.get(requestGroup.parentId)!.projectId,
        workspaceId: parentReferences.get(requestGroup.parentId)!.workspaceId,
      });
    }

    return [...requestGroups, ...childRequestGroups];
  };

  const allRequestGroups = await getRequestGroups({
    $in: workspaceIds,
  });

  const requests = await database.find<Request>(request.type, {
    parentId: {
      $in: [...workspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)],
    },
  });

  for (const request of requests) {
    parentReferences.set(request._id, {
      type: 'Request',
      organizationId: parentReferences.get(request.parentId)!.organizationId,
      projectId: parentReferences.get(request.parentId)!.projectId,
      workspaceId: parentReferences.get(request.parentId)!.workspaceId,
    });
  }

  const grpcRequests = await database.find<GrpcRequest>(grpcRequest.type, {
    parentId: {
      $in: [...workspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)],
    },
  });

  for (const grpcRequest of grpcRequests) {
    parentReferences.set(grpcRequest._id, {
      type: 'GrpcRequest',
      organizationId: parentReferences.get(grpcRequest.parentId)!.organizationId,
      projectId: parentReferences.get(grpcRequest.parentId)!.projectId,
      workspaceId: parentReferences.get(grpcRequest.parentId)!.workspaceId,
    });
  }

  const webSocketRequests = await database.find<WebSocketRequest>(models.webSocketRequest.type, {
    parentId: {
      $in: [...workspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)],
    },
  });

  for (const webSocketRequest of webSocketRequests) {
    parentReferences.set(webSocketRequest._id, {
      type: 'WebSocketRequest',
      organizationId: parentReferences.get(webSocketRequest.parentId)!.organizationId,
      projectId: parentReferences.get(webSocketRequest.parentId)!.projectId,
      workspaceId: parentReferences.get(webSocketRequest.parentId)!.workspaceId,
    });
  }

  const allRequests = [...requests, ...grpcRequests, ...webSocketRequests];

  const [baseEnvironment] = await database.find<Environment>(environment.type, {
    parentId: workspaceId,
  });

  const subEnvironments = await database.find<Environment>(environment.type, {
    parentId: baseEnvironment?._id,
  });

  const environments = baseEnvironment ? [baseEnvironment, ...subEnvironments] : [];

  const currentRequests = allRequests.filter(request => {
    return parentReferences.get(request.parentId)!.workspaceId === workspaceId;
  });

  const otherRequests = allRequests.filter(request => {
    return parentReferences.get(request.parentId)!.workspaceId !== workspaceId;
  });

  const currentFiles = allOrganizationWorkspaces.filter(workspace => {
    return workspace.parentId === projectId;
  });

  const otherFiles = allOrganizationWorkspaces.filter(workspace => {
    return workspace.parentId !== projectId;
  });

  return {
    current: {
      requests: currentRequests
        .filter(requestFilter)
        .slice(0, 100)
        .map(item => {
          const organizationId = parentReferences.get(item.parentId)?.organizationId || '';
          const projectId = parentReferences.get(item.parentId)?.projectId || '';
          const workspaceId = parentReferences.get(item.parentId)?.workspaceId || '';
          return {
            id: item._id,
            url: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${item._id}`,
            name: item.name,
            item,
            organizationName: allOrganizations.find(org => org.id === organizationId)?.display_name || '',
            projectName: allProjects.find(project => project._id === projectId)?.name || '',
            workspaceName: allOrganizationWorkspaces.find(workspace => workspace._id === workspaceId)?.name || '',
            organizationId,
            projectId,
            workspaceId,
          };
        }),
      files: currentFiles.map(workspace => {
        const organizationId = parentReferences.get(workspace.parentId)?.organizationId || '';
        const projectId = parentReferences.get(workspace.parentId)?.projectId || '';
        const parentProject = allProjects.find(project => project._id === workspace.parentId);
        return {
          id: workspace._id,
          url: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${models.workspace.scopeToActivity(workspace.scope)}`,
          name: workspace.name,
          item: {
            ...workspace,
            teamProjectId: parentProject && project.isRemoteProject(parentProject) ? parentProject.remoteId : '',
          },
          organizationName: allOrganizations.find(org => org.id === organizationId)?.display_name || '',
          projectName: allProjects.find(project => project._id === projectId)?.name || '',
          organizationId,
          projectId,
        };
      }),
      environments,
    },
    other: {
      requests: otherRequests
        .filter(requestFilter)
        .slice(0, 100)
        .map(item => {
          const organizationId = parentReferences.get(item.parentId)?.organizationId || '';
          const projectId = parentReferences.get(item.parentId)?.projectId || '';
          const workspaceId = parentReferences.get(item.parentId)?.workspaceId || '';
          return {
            id: item._id,
            url: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${item._id}`,
            name: item.name,
            item,
            organizationName: allOrganizations.find(org => org.id === organizationId)?.display_name || '',
            projectName: allProjects.find(project => project._id === projectId)?.name || '',
            workspaceName: allOrganizationWorkspaces.find(workspace => workspace._id === workspaceId)?.name || '',
            organizationId,
            projectId,
            workspaceId,
          };
        }),
      files: otherFiles.map(workspace => {
        const organizationId = parentReferences.get(workspace.parentId)?.organizationId || '';
        const projectId = parentReferences.get(workspace.parentId)?.projectId || '';
        const parentProject = allProjects.find(project => project._id === workspace.parentId);
        return {
          id: workspace._id,
          url: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/${models.workspace.scopeToActivity(workspace.scope)}`,
          name: workspace.name,
          item: {
            ...workspace,
            teamProjectId: parentProject && project.isRemoteProject(parentProject) ? parentProject.remoteId : '',
          },
          organizationName: allOrganizations.find(org => org.id === organizationId)?.display_name || '',
          projectName: allProjects.find(project => project._id === projectId)?.name || '',
          organizationId,
          projectId,
        };
      }),
    },
  };
}

export const useCommandsLoaderFetcher = createFetcherLoadHook(
  load =>
    ({
      organizationId,
      projectId,
      workspaceId,
      filter,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId?: string;
      filter?: string;
    }) => {
      const params = new URLSearchParams();
      params.set('organizationId', organizationId);
      params.set('projectId', projectId);
      if (workspaceId) {
        params.set('workspaceId', workspaceId);
      }
      if (filter) {
        params.set('filter', filter);
      }

      return load(`/commands?${params.toString()}`, {
        flushSync: true,
      });
    },
  clientLoader,
);
