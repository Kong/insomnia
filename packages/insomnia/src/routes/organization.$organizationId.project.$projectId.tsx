import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useState } from 'react';
import { Button, Heading, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, Outlet, redirect, useLoaderData, useMatches, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { DEFAULT_SIDEBAR_SIZE } from '~/common/constants';
import { database } from '~/common/database';
import { isNotNullOrUndefined } from '~/common/misc';
import * as models from '~/models';
import type { GitRepository } from '~/models/git-repository';
import type { GrpcRequest } from '~/models/grpc-request';
import { sortProjects } from '~/models/helpers/project';
import type { McpRequest } from '~/models/mcp-request';
import { isScratchpadOrganizationId } from '~/models/organization';
import { isGitProject, isLocalProject, isRemoteProject, type Project } from '~/models/project';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { WebSocketRequest } from '~/models/websocket-request';
import { type Workspace, type WorkspaceScope } from '~/models/workspace';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';
import { useRequestGroupDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';
import { useRequestGroupDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.duplicate';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { SyncDropdown } from '~/ui/components/dropdowns/sync-dropdown';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { OrganizationSelect } from '~/ui/components/project/organization-select';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { isPrimaryClickModifier } from '~/ui/utils';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId';

interface ProjectSidebarFile {
  id: string;
  name: string;
  scope: WorkspaceScope;
  workspace: Workspace;
}

type RequestLike = Request | GrpcRequest | WebSocketRequest | SocketIORequest | McpRequest;

interface CollectionTreeNode {
  _id: string;
  parentId: string;
  name: string;
  nodeType: 'request-group' | 'request';
  requestMethod?: string;
  doc: RequestGroup | RequestLike;
}

interface ProjectRouteLoaderData {
  activeProject: Project;
  projects: (Project & { gitRepository?: GitRepository })[];
  projectFilesByProjectId: Record<string, ProjectSidebarFile[]>;
  collectionTreeByWorkspaceId: Record<string, CollectionTreeNode[]>;
}

async function getProjectsWithGitRepositories({
  organizationId,
}: {
  organizationId: string;
}): Promise<(Project & { gitRepository?: GitRepository })[]> {
  const projects = await database.find<Project>('Project', {
    parentId: organizationId,
  });

  const gitRepositoryIds = projects.map(p => p.gitRepositoryId).filter(isNotNullOrUndefined);
  const gitRepositories = await database.find<GitRepository>('GitRepository', {
    _id: {
      $in: gitRepositoryIds,
    },
  });

  return projects.map(project => {
    const gitRepository = gitRepositories.find(gr => gr._id === project.gitRepositoryId);
    return {
      ...project,
      gitRepository,
    };
  });
}

async function getProjectSidebarFiles(projectId: string): Promise<ProjectSidebarFile[]> {
  const workspaces = await models.workspace.findByParentId(projectId);
  return workspaces.map(workspace => ({
    id: workspace._id,
    name: workspace.name,
    scope: workspace.scope,
    workspace,
  }));
}

async function getCollectionTreeByWorkspaceId({
  collectionWorkspaceIds,
}: {
  collectionWorkspaceIds: string[];
}): Promise<Record<string, CollectionTreeNode[]>> {
  if (!collectionWorkspaceIds.length) {
    return {};
  }

  const parentToWorkspaceId = new Map<string, string>();
  collectionWorkspaceIds.forEach(workspaceId => parentToWorkspaceId.set(workspaceId, workspaceId));

  const allRequestGroups: RequestGroup[] = [];
  let queue = [...collectionWorkspaceIds];

  while (queue.length) {
    const requestGroups = await database.find<RequestGroup>(models.requestGroup.type, {
      parentId: { $in: queue },
    });

    if (!requestGroups.length) {
      break;
    }

    requestGroups.forEach(requestGroup => {
      const workspaceId = parentToWorkspaceId.get(requestGroup.parentId);
      if (workspaceId) {
        parentToWorkspaceId.set(requestGroup._id, workspaceId);
      }
    });

    allRequestGroups.push(...requestGroups);
    queue = requestGroups.map(requestGroup => requestGroup._id);
  }

  const parentIds = [...collectionWorkspaceIds, ...allRequestGroups.map(requestGroup => requestGroup._id)];

  const [httpRequests, grpcRequests, webSocketRequests, socketIoRequests, mcpRequests] = await Promise.all([
    database.find<Request>(models.request.type, { parentId: { $in: parentIds } }),
    database.find<GrpcRequest>(models.grpcRequest.type, { parentId: { $in: parentIds } }),
    database.find<WebSocketRequest>(models.webSocketRequest.type, { parentId: { $in: parentIds } }),
    database.find<SocketIORequest>(models.socketIORequest.type, { parentId: { $in: parentIds } }),
    database.find<McpRequest>(models.mcpRequest.type, { parentId: { $in: parentIds } }),
  ]);

  const requestNodes: RequestLike[] = [
    ...httpRequests,
    ...grpcRequests,
    ...webSocketRequests,
    ...socketIoRequests,
    ...mcpRequests,
  ];

  const treeByWorkspaceId: Record<string, CollectionTreeNode[]> = {};
  for (const workspaceId of collectionWorkspaceIds) {
    treeByWorkspaceId[workspaceId] = [];
  }

  allRequestGroups.forEach(requestGroup => {
    const workspaceId = parentToWorkspaceId.get(requestGroup.parentId);
    if (!workspaceId) {
      return;
    }

    treeByWorkspaceId[workspaceId].push({
      _id: requestGroup._id,
      parentId: requestGroup.parentId,
      name: requestGroup.name,
      nodeType: 'request-group',
      doc: requestGroup,
    });
  });

  requestNodes.forEach(requestNode => {
    const workspaceId = parentToWorkspaceId.get(requestNode.parentId);
    if (!workspaceId) {
      return;
    }

    treeByWorkspaceId[workspaceId].push({
      _id: requestNode._id,
      parentId: requestNode.parentId,
      name: requestNode.name,
      nodeType: 'request',
      requestMethod: 'method' in requestNode ? requestNode.method : undefined,
      doc: requestNode,
    });
  });

  return treeByWorkspaceId;
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const { organizationId, projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);

  if (!project) {
    return redirect(href('/organization/:organizationId', { organizationId }));
  }

  const organizationProjects = sortProjects(await getProjectsWithGitRepositories({ organizationId }));
  const projectFilesByProjectId = Object.fromEntries(
    await Promise.all(
      organizationProjects.map(async organizationProject => {
        const files = await getProjectSidebarFiles(organizationProject._id);
        return [organizationProject._id, files] as const;
      }),
    ),
  );
  const collectionWorkspaceIds = Object.values(projectFilesByProjectId)
    .flat()
    .filter(file => file.scope === 'collection')
    .map(file => file.id);
  const collectionTreeByWorkspaceId = await getCollectionTreeByWorkspaceId({ collectionWorkspaceIds });

  return {
    activeProject: project,
    projects: organizationProjects,
    projectFilesByProjectId,
    collectionTreeByWorkspaceId,
  };
}

export function useProjectLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId');
}

const workspaceScopeOrder: Record<WorkspaceScope, number> = {
  collection: 0,
  environment: 1,
  mcp: 2,
  design: 3,
  'mock-server': 4,
};

const workspaceScopeIcon: Record<WorkspaceScope, IconProp> = {
  collection: 'bars',
  environment: 'code',
  mcp: ['fac', 'mcp'] as unknown as IconProp,
  design: 'file',
  'mock-server': 'server',
};

function ProjectSidebarShell() {
  const { activeProject, projects, projectFilesByProjectId, collectionTreeByWorkspaceId } =
    useLoaderData() as ProjectRouteLoaderData;
  const { organizationId, workspaceId, requestId, requestGroupId } = useParams() as {
    organizationId: string;
    workspaceId?: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const navigate = useNavigate();
  const tabNavigate = useTabNavigate();
  const organizationData = useOrganizationLoaderData();
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [activeCollectionTarget, setActiveCollectionTarget] = useState<{
    project: Project;
    workspace: Workspace;
  } | null>(null);
  const [isCollectionImportModalOpen, setIsCollectionImportModalOpen] = useState(false);
  const [isCollectionPasteCurlModalOpen, setIsCollectionPasteCurlModalOpen] = useState(false);
  const [folderPasteCurlTarget, setFolderPasteCurlTarget] = useState<{
    project: Project;
    workspace: Workspace;
    parentId: string;
  } | null>(null);
  const [isFolderPasteCurlModalOpen, setIsFolderPasteCurlModalOpen] = useState(false);
  const createRequestFetcher = useRequestNewActionFetcher();
  const createRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const createWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const updateRequestFetcher = useRequestUpdateActionFetcher();
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const updateRequestGroupFetcher = useRequestGroupUpdateActionFetcher();
  const duplicateRequestGroupFetcher = useRequestGroupDuplicateActionFetcher();
  const deleteRequestGroupFetcher = useRequestGroupDeleteActionFetcher();
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const loadStorageRules = storageRuleFetcher.load;
  const { storagePromise } = storageRuleFetcher.data || {};
  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);
  const activeProjectGitRepository = activeProject?.gitRepositoryId
    ? projects.find(project => project._id === activeProject._id)?.gitRepository
    : undefined;
  const projectWorkspaces = projectFilesByProjectId[activeProject._id] ?? [];
  const activeWorkspace =
    (workspaceId ? projectWorkspaces.find(file => file.id === workspaceId)?.workspace : null) ||
    projectWorkspaces.find(file => file.scope === 'collection')?.workspace ||
    projectWorkspaces[0]?.workspace ||
    null;
  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      loadStorageRules({ organizationId });
    }
  }, [loadStorageRules, organizationId]);

  const [expandedProjectIds, setExpandedProjectIds] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-projects`,
    activeProject?._id ? [activeProject._id] : [],
  );
  const [expandedCollectionKeys, setExpandedCollectionKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-collections`,
    [],
  );
  const [expandedRequestGroupKeys, setExpandedRequestGroupKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-request-groups`,
    [],
  );
  const expandedProjectIdList = Array.isArray(expandedProjectIds) ? expandedProjectIds : [];
  const expandedCollectionKeyList = Array.isArray(expandedCollectionKeys) ? expandedCollectionKeys : [];
  const expandedRequestGroupKeyList = Array.isArray(expandedRequestGroupKeys) ? expandedRequestGroupKeys : [];

  const toggleProjectExpanded = (id: string) => {
    const next = expandedProjectIdList.includes(id)
      ? expandedProjectIdList.filter(value => value !== id)
      : [...expandedProjectIdList, id];
    setExpandedProjectIds(next);
  };

  const toggleCollectionExpanded = (key: string) => {
    const next = expandedCollectionKeyList.includes(key)
      ? expandedCollectionKeyList.filter(value => value !== key)
      : [...expandedCollectionKeyList, key];
    setExpandedCollectionKeys(next);
  };

  const toggleRequestGroupExpanded = (key: string) => {
    const next = expandedRequestGroupKeyList.includes(key)
      ? expandedRequestGroupKeyList.filter(value => value !== key)
      : [...expandedRequestGroupKeyList, key];
    setExpandedRequestGroupKeys(next);
  };

  const openFileFromTree = (project: Project, file: ProjectSidebarFile, withTab?: boolean) => {
    const searchParams = new URLSearchParams();
    if (file.scope === 'collection') {
      searchParams.set('doNotSkipToActiveRequest', 'true');
    }

    tabNavigate(
      {
        organization: organizationId,
        project,
        workspace: file.workspace,
        item: file.workspace,
      },
      {
        withTab,
        shouldNavigate: true,
        searchParams,
      },
    );
  };

  const openCollectionTreeNode = ({
    project,
    workspace,
    node,
    withTab,
  }: {
    project: Project;
    workspace: Workspace;
    node: CollectionTreeNode;
    withTab?: boolean;
  }) => {
    tabNavigate(
      {
        organization: organizationId,
        project,
        workspace,
        item: node.doc,
      },
      {
        withTab,
        shouldNavigate: true,
      },
    );
  };

  const getRequestMethodBadgeClass = (method: string) =>
    (
      {
        GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
        POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
        HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
        OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
        DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
        PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
        PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
      } as Record<string, string>
    )[method] || 'bg-(--hl-md) text-(--color-font)';

  const createCollectionRequest = ({
    project,
    workspace,
    requestType,
    parentId,
    req,
  }: {
    project: Project;
    workspace: Workspace;
    requestType: 'HTTP' | 'Event Stream' | 'GraphQL' | 'gRPC' | 'WebSocket' | 'SocketIO' | 'From Curl';
    parentId?: string;
    req?: Partial<Request>;
  }) => {
    createRequestFetcher.submit({
      organizationId,
      projectId: project._id,
      workspaceId: workspace._id,
      requestType,
      parentId: parentId || workspace._id,
      req,
    });
  };

  return (
    <>
      <PanelGroup
        autoSaveId="insomnia-sidebar"
        id="wrapper"
        className="new-sidebar h-full w-full text-(--color-font)"
        direction="horizontal"
      >
        <Panel
          id="sidebar"
          className="sidebar theme--sidebar"
          defaultSize={DEFAULT_SIDEBAR_SIZE}
          maxSize={40}
          minSize={10}
          collapsible
        >
          <div className="flex flex-1 flex-col divide-y divide-solid divide-(--hl-md) overflow-hidden">
            <OrganizationSelect
              organizationId={organizationId}
              organizations={organizationData?.organizations || []}
              onSelect={id => navigate(`/organization/${id}`)}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between p-(--padding-sm)">
                <Heading className="text-xs uppercase">Projects</Heading>
                <Button
                  aria-label="Create new Project"
                  onPress={() => setIsNewProjectModalOpen(true)}
                  className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="plus-circle" />
                </Button>
              </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
                {projects.map(project => {
                  const isProjectExpanded = expandedProjectIdList.includes(project._id);
                  const isActiveProject = project._id === activeProject?._id;
                  const files = projectFilesByProjectId[project._id] || [];

                  return (
                    <div key={project._id} className="flex flex-col">
                    <div
                      className={`group flex w-full min-w-0 items-center gap-1 rounded-xs px-2 py-1 ${
                        isActiveProject ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'
                      }`}
                    >
                      <Button
                        aria-label={`${isProjectExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
                        onPress={() => toggleProjectExpanded(project._id)}
                        className="flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                      >
                        <Icon icon={isProjectExpanded ? 'chevron-down' : 'chevron-right'} className="h-3 w-3" />
                      </Button>
                      <Button
                        aria-label={`Open project ${project.name}`}
                        onPress={() => navigate(`/organization/${organizationId}/project/${project._id}`)}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-1 text-left text-sm transition-colors ${
                          isActiveProject
                            ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'
                        }`}
                      >
                        <Icon
                          icon={
                            isRemoteProject(project)
                              ? 'globe-americas'
                              : isGitProject(project)
                                ? (['fab', 'git-alt'] as unknown as IconProp)
                                : 'laptop'
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                      </Button>
                      <MenuTrigger>
                        <Button
                          aria-label={`Actions for project ${project.name}`}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 pointer-events-none transition-all hover:bg-(--hl-xs) group-hover:opacity-100 group-hover:pointer-events-auto group-focus:opacity-100 group-focus:pointer-events-auto focus:opacity-100 focus:pointer-events-auto data-pressed:opacity-100 data-pressed:pointer-events-auto"
                        >
                          <Icon icon="ellipsis-h" />
                        </Button>
                        <Popover className="flex min-w-max flex-col overflow-y-hidden">
                          <Menu
                            aria-label="Project actions"
                            onAction={key => {
                              if (key === 'new-collection') {
                                createWorkspaceFetcher.submit({
                                  organizationId,
                                  projectId: project._id,
                                  scope: 'collection',
                                  name: 'My Collection',
                                });
                              }
                              if (key === 'new-environment') {
                                createWorkspaceFetcher.submit({
                                  organizationId,
                                  projectId: project._id,
                                  scope: 'environment',
                                  name: 'New Environment',
                                });
                              }
                              if (key === 'new-mcp') {
                                createWorkspaceFetcher.submit({
                                  organizationId,
                                  projectId: project._id,
                                  scope: 'mcp',
                                  name: 'MCP Client',
                                });
                              }
                              if (key === 'new-document') {
                                createWorkspaceFetcher.submit({
                                  organizationId,
                                  projectId: project._id,
                                  scope: 'design',
                                  name: 'my-spec.yaml',
                                });
                              }
                            }}
                            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                          >
                            <MenuItem id="new-collection" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">New Collection</MenuItem>
                            <MenuItem id="new-environment" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">New Environment</MenuItem>
                            <MenuItem id="new-mcp" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">New MCP Client</MenuItem>
                            <MenuItem id="new-document" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">New Document</MenuItem>
                          </Menu>
                        </Popover>
                      </MenuTrigger>
                    </div>
                    {isProjectExpanded && (
                      <div className="relative mb-1 flex flex-col">
                        <div
                          className="pointer-events-none absolute top-0 bottom-0 w-px -translate-x-1/2 bg-(--hl-sm)"
                          style={{ left: '17px' }}
                        />
                        {files
                          .slice()
                          .sort((a, b) => {
                            const scopeDiff = workspaceScopeOrder[a.scope] - workspaceScopeOrder[b.scope];
                            return scopeDiff !== 0 ? scopeDiff : a.name.localeCompare(b.name);
                          })
                          .map(file => {
                            if (file.scope !== 'collection') {
                              const isWorkspaceActive =
                                workspaceId === file.workspace._id && !requestId && !requestGroupId;
                              return (
                                <div key={`${project._id}:${file.id}`} className="min-w-0">
                                  <div
                                    className={`group flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pl-6 pr-2 ${
                                      isWorkspaceActive ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'
                                    }`}
                                  >
                                    <span className="h-5 w-5 shrink-0" />
                                    <Button
                                      aria-label={`Open ${file.name}`}
                                      onPress={e => openFileFromTree(project, file, isPrimaryClickModifier(e))}
                                      className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs py-1 pr-2 pl-2 text-left text-sm transition-colors ${
                                        isWorkspaceActive
                                          ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'
                                      }`}
                                    >
                                      <Icon icon={workspaceScopeIcon[file.scope]} className="w-3.5" />
                                      <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                    </Button>
                                    <MenuTrigger>
                                      <Button
                                        aria-label={`Actions for ${file.name}`}
                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 pointer-events-none transition-all hover:bg-(--hl-xs) group-hover:opacity-100 group-hover:pointer-events-auto group-focus:opacity-100 group-focus:pointer-events-auto focus:opacity-100 focus:pointer-events-auto data-pressed:opacity-100 data-pressed:pointer-events-auto"
                                      >
                                        <Icon icon="ellipsis-h" />
                                      </Button>
                                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                        <Menu
                                          aria-label="Workspace actions"
                                          onAction={key => {
                                            if (key === 'open-new-tab') {
                                              openFileFromTree(project, file, true);
                                            }
                                            if (key === 'rename') {
                                              showModal(PromptModal, {
                                                title: 'Rename Workspace',
                                                defaultValue: file.name,
                                                submitName: 'Rename',
                                                label: 'Name',
                                                selectText: true,
                                                onComplete: name =>
                                                  updateWorkspaceFetcher.submit({
                                                    organizationId,
                                                    projectId: project._id,
                                                    patch: {
                                                      workspaceId: file.workspace._id,
                                                      name,
                                                    },
                                                  }),
                                              });
                                            }
                                            if (key === 'delete') {
                                              showModal(AskModal, {
                                                title: 'Delete Workspace',
                                                message: `Do you really want to delete "${file.name}"?`,
                                                yesText: 'Delete',
                                                noText: 'Cancel',
                                                color: 'danger',
                                                onDone: (isYes: boolean) => {
                                                  if (isYes) {
                                                    deleteWorkspaceFetcher.submit({
                                                      organizationId,
                                                      projectId: project._id,
                                                      workspaceId: file.workspace._id,
                                                    });
                                                  }
                                                },
                                              });
                                            }
                                          }}
                                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                                        >
                                          <MenuItem id="open-new-tab" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Open in New Tab</MenuItem>
                                          <MenuItem id="rename" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Rename</MenuItem>
                                          <MenuItem id="delete" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-danger) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Delete</MenuItem>
                                        </Menu>
                                      </Popover>
                                    </MenuTrigger>
                                  </div>
                                </div>
                              );
                            }

                            const collectionKey = `${project._id}:${file.id}`;
                            const isCollectionExpanded = expandedCollectionKeyList.includes(collectionKey);
                            const collectionTreeNodes = collectionTreeByWorkspaceId[file.id] || [];
                            const rootNodes = collectionTreeNodes
                              .filter(node => node.parentId === file.id)
                              .sort((a, b) => a.name.localeCompare(b.name));

                            const renderTreeNodes = (parentId: string, depth: number) => {
                              return collectionTreeNodes
                                .filter(node => node.parentId === parentId)
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(node => {
                                  const requestGroupKey = `${project._id}:${file.id}:${node._id}`;
                                  const isRequestGroupExpanded = expandedRequestGroupKeyList.includes(requestGroupKey);
                                  const hasChildren = collectionTreeNodes.some(
                                    childNode => childNode.parentId === node._id,
                                  );

                                  if (node.nodeType === 'request-group') {
                                    return (
                                      <div key={requestGroupKey} className="flex flex-col">
                                        <div
                                          className={`group flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pr-2 ${
                                            requestGroupId === node._id ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'
                                          }`}
                                          style={{ paddingLeft: `${depth}px` }}
                                        >
                                          <Button
                                            aria-label={`${isRequestGroupExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
                                            onPress={() => toggleRequestGroupExpanded(requestGroupKey)}
                                            className="flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                                          >
                                            <Icon
                                              icon={isRequestGroupExpanded ? 'chevron-down' : 'chevron-right'}
                                              className="h-3 w-3"
                                            />
                                          </Button>
                                          <Button
                                            aria-label={`Open folder ${node.name}`}
                                            onPress={e =>
                                              openCollectionTreeNode({
                                                project,
                                                workspace: file.workspace,
                                                node,
                                                withTab: isPrimaryClickModifier(e),
                                              })
                                            }
                                            className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left text-sm transition-colors ${
                                              requestGroupId === node._id
                                                ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'
                                            }`}
                                          >
                                            <Icon icon="folder" className="w-3" />
                                            <span className="min-w-0 flex-1 truncate">{node.name}</span>
                                          </Button>
                                          <MenuTrigger>
                                            <Button
                                              aria-label={`Actions for folder ${node.name}`}
                                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 pointer-events-none transition-all hover:bg-(--hl-xs) group-hover:opacity-100 group-hover:pointer-events-auto group-focus:opacity-100 group-focus:pointer-events-auto focus:opacity-100 focus:pointer-events-auto data-pressed:opacity-100 data-pressed:pointer-events-auto"
                                            >
                                              <Icon icon="ellipsis-h" />
                                            </Button>
                                            <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                              <Menu
                                                aria-label="Folder actions"
                                                onAction={key => {
                                                  const requestGroup = node.doc as RequestGroup;
                                                  if (key === 'open-new-tab') {
                                                    openCollectionTreeNode({
                                                      project,
                                                      workspace: file.workspace,
                                                      node,
                                                      withTab: true,
                                                    });
                                                  }
                                                  if (key === 'new-folder') {
                                                    showModal(PromptModal, {
                                                      title: 'New Folder',
                                                      defaultValue: 'My Folder',
                                                      submitName: 'Create',
                                                      label: 'Name',
                                                      selectText: true,
                                                      onComplete: name =>
                                                        createRequestGroupFetcher.submit({
                                                          organizationId,
                                                          projectId: project._id,
                                                          workspaceId: file.workspace._id,
                                                          parentId: requestGroup._id,
                                                          name,
                                                        }),
                                                    });
                                                  }
                                                  if (key === 'new-http') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'HTTP',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'new-event-stream') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'Event Stream',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'new-graphql') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'GraphQL',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'new-grpc') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'gRPC',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'new-websocket') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'WebSocket',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'new-socketio') {
                                                    createCollectionRequest({
                                                      project,
                                                      workspace: file.workspace,
                                                      requestType: 'SocketIO',
                                                      parentId: requestGroup._id,
                                                    });
                                                  }
                                                  if (key === 'import-curl') {
                                                    setFolderPasteCurlTarget({
                                                      project,
                                                      workspace: file.workspace,
                                                      parentId: requestGroup._id,
                                                    });
                                                    setIsFolderPasteCurlModalOpen(true);
                                                  }
                                                  if (key === 'duplicate') {
                                                    showModal(PromptModal, {
                                                      title: 'Duplicate Folder',
                                                      defaultValue: requestGroup.name,
                                                      submitName: 'Create',
                                                      label: 'New Name',
                                                      selectText: true,
                                                      onComplete: name =>
                                                        duplicateRequestGroupFetcher.submit({
                                                          organizationId,
                                                          projectId: project._id,
                                                          workspaceId: file.workspace._id,
                                                          requestGroupData: {
                                                            _id: requestGroup._id,
                                                            name,
                                                          },
                                                        }),
                                                    });
                                                  }
                                                  if (key === 'rename') {
                                                    showModal(PromptModal, {
                                                      title: 'Rename Folder',
                                                      defaultValue: requestGroup.name,
                                                      submitName: 'Save',
                                                      label: 'Name',
                                                      selectText: true,
                                                      onComplete: name =>
                                                        updateRequestGroupFetcher.submit({
                                                          organizationId,
                                                          projectId: project._id,
                                                          workspaceId: file.workspace._id,
                                                          requestGroupId: requestGroup._id,
                                                          patch: {
                                                            name,
                                                          },
                                                        }),
                                                    });
                                                  }
                                                  if (key === 'delete') {
                                                    showModal(AskModal, {
                                                      title: 'Delete Folder',
                                                      message: `Do you really want to delete "${requestGroup.name}"?`,
                                                      yesText: 'Delete',
                                                      noText: 'Cancel',
                                                      color: 'danger',
                                                      onDone: (isYes: boolean) => {
                                                        if (isYes) {
                                                          deleteRequestGroupFetcher.submit({
                                                            organizationId,
                                                            projectId: project._id,
                                                            workspaceId: file.workspace._id,
                                                            id: requestGroup._id,
                                                          });
                                                        }
                                                      },
                                                    });
                                                  }
                                                  if (key === 'run-folder') {
                                                    tabNavigate(
                                                      {
                                                        organization: organizationId,
                                                        project,
                                                        workspace: file.workspace,
                                                        item: requestGroup,
                                                      },
                                                      {
                                                        shouldNavigate: true,
                                                        asRunner: true,
                                                      },
                                                    );
                                                  }
                                                }}
                                                className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                                              >
                                                <MenuItem id="open-new-tab" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Open in New Tab</MenuItem>
                                                <MenuItem id="new-folder" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">New Folder</MenuItem>
                                                <MenuItem id="new-http" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">HTTP Request</MenuItem>
                                                <MenuItem id="new-event-stream" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Event Stream Request (SSE)</MenuItem>
                                                <MenuItem id="new-graphql" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">GraphQL Request</MenuItem>
                                                <MenuItem id="new-grpc" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">gRPC Request</MenuItem>
                                                <MenuItem id="new-websocket" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">WebSocket Request</MenuItem>
                                                <MenuItem id="new-socketio" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Socket.IO Request</MenuItem>
                                                <MenuItem id="import-curl" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Import From Curl</MenuItem>
                                                <MenuItem id="duplicate" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Duplicate</MenuItem>
                                                <MenuItem id="rename" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Rename</MenuItem>
                                                <MenuItem id="run-folder" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Run Folder</MenuItem>
                                                <MenuItem id="delete" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-danger) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Delete</MenuItem>
                                              </Menu>
                                            </Popover>
                                          </MenuTrigger>
                                        </div>
                                        {isRequestGroupExpanded && (
                                          hasChildren ? (
                                            <div className="relative flex flex-col">
                                              <div
                                                className="pointer-events-none absolute top-0 bottom-0 w-px -translate-x-1/2 bg-(--hl-sm)"
                                                style={{ left: `${depth + 9}px` }}
                                              />
                                              {renderTreeNodes(node._id, depth + 16)}
                                            </div>
                                          ) : (
                                            <div
                                              className="py-1 pr-2 text-xs text-(--hl)"
                                              style={{ paddingLeft: `${depth + 22}px` }}
                                            >
                                              Empty folder
                                            </div>
                                          )
                                        )}
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={requestGroupKey}
                                      className={`group flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pr-2 ${
                                        requestId === node._id ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)'
                                      }`}
                                    >
                                      <Button
                                        aria-label={`Open request ${node.name}`}
                                        onPress={e =>
                                          openCollectionTreeNode({
                                            project,
                                            workspace: file.workspace,
                                            node,
                                            withTab: isPrimaryClickModifier(e),
                                          })
                                        }
                                        className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs py-1 pr-2 pl-2 text-left text-sm transition-colors ${
                                          requestId === node._id
                                            ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'
                                        }`}
                                        style={{ paddingLeft: `${depth + 18}px` }}
                                      >
                                        {node.requestMethod && (
                                          <span
                                            className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${getRequestMethodBadgeClass(node.requestMethod)}`}
                                          >
                                            {getMethodShortHand({ method: node.requestMethod } as Request)}
                                          </span>
                                        )}
                                        <span className="min-w-0 flex-1 truncate">{node.name}</span>
                                      </Button>
                                      <MenuTrigger>
                                        <Button
                                          aria-label={`Actions for request ${node.name}`}
                                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 pointer-events-none transition-all hover:bg-(--hl-xs) group-hover:opacity-100 group-hover:pointer-events-auto group-focus:opacity-100 group-focus:pointer-events-auto focus:opacity-100 focus:pointer-events-auto data-pressed:opacity-100 data-pressed:pointer-events-auto"
                                        >
                                          <Icon icon="ellipsis-h" />
                                        </Button>
                                        <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                          <Menu
                                            aria-label="Request actions"
                                            onAction={key => {
                                              const request = node.doc as RequestLike;
                                              if (key === 'open-new-tab') {
                                                openCollectionTreeNode({
                                                  project,
                                                  workspace: file.workspace,
                                                  node,
                                                  withTab: true,
                                                });
                                              }
                                              if (key === 'duplicate') {
                                                showModal(PromptModal, {
                                                  title: 'Duplicate Request',
                                                  defaultValue: request.name,
                                                  submitName: 'Create',
                                                  label: 'New Name',
                                                  selectText: true,
                                                  onComplete: name =>
                                                    duplicateRequestFetcher.submit({
                                                      organizationId,
                                                      projectId: project._id,
                                                      workspaceId: file.workspace._id,
                                                      requestId: request._id,
                                                      name,
                                                    }),
                                                });
                                              }
                                              if (key === 'rename') {
                                                showModal(PromptModal, {
                                                  title: 'Rename Request',
                                                  defaultValue: request.name,
                                                  submitName: 'Save',
                                                  label: 'Name',
                                                  selectText: true,
                                                  onComplete: name =>
                                                    updateRequestFetcher.submit({
                                                      organizationId,
                                                      projectId: project._id,
                                                      workspaceId: file.workspace._id,
                                                      requestId: request._id,
                                                      patch: {
                                                        name,
                                                      },
                                                    }),
                                                });
                                              }
                                              if (key === 'delete') {
                                                showModal(AskModal, {
                                                  title: 'Delete Request',
                                                  message: `Do you really want to delete "${request.name}"?`,
                                                  yesText: 'Delete',
                                                  noText: 'Cancel',
                                                  color: 'danger',
                                                  onDone: (isYes: boolean) => {
                                                    if (isYes) {
                                                      deleteRequestFetcher.submit({
                                                        organizationId,
                                                        projectId: project._id,
                                                        workspaceId: file.workspace._id,
                                                        id: request._id,
                                                      });
                                                    }
                                                  },
                                                });
                                              }
                                            }}
                                            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                                          >
                                            <MenuItem id="open-new-tab" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Open in New Tab</MenuItem>
                                            <MenuItem id="duplicate" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Duplicate</MenuItem>
                                            <MenuItem id="rename" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Rename</MenuItem>
                                            <MenuItem id="delete" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-danger) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Delete</MenuItem>
                                          </Menu>
                                        </Popover>
                                      </MenuTrigger>
                                    </div>
                                  );
                                });
                            };

                            return (
                              <div key={collectionKey} className="flex flex-col">
                                <div
                                  className={`group flex w-full min-w-0 items-center gap-1 rounded-xs py-1 pl-6 pr-2 ${
                                    workspaceId === file.workspace._id && !requestId && !requestGroupId
                                      ? 'bg-(--hl-sm)'
                                      : 'hover:bg-(--hl-xs)'
                                  }`}
                                >
                                  <Button
                                    aria-label={`${isCollectionExpanded ? 'Collapse' : 'Expand'} ${file.name}`}
                                    onPress={() => toggleCollectionExpanded(collectionKey)}
                                    className="flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                                  >
                                    <Icon
                                      icon={isCollectionExpanded ? 'chevron-down' : 'chevron-right'}
                                      className="h-3 w-3"
                                    />
                                  </Button>
                                  <Button
                                    aria-label={`Open ${file.name}`}
                                    onPress={e => openFileFromTree(project, file, isPrimaryClickModifier(e))}
                                    className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left text-sm transition-colors ${
                                      workspaceId === file.workspace._id && !requestId && !requestGroupId
                                        ? 'text-(--color-font)' : 'text-(--hl) hover:text-(--color-font)'
                                    }`}
                                  >
                                    <Icon icon={workspaceScopeIcon[file.scope]} className="w-3.5" />
                                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                                  </Button>
                                  <MenuTrigger>
                                    <Button
                                      aria-label={`Actions for ${file.name}`}
                                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xs text-(--hl) opacity-0 pointer-events-none transition-all hover:bg-(--hl-xs) group-hover:opacity-100 group-hover:pointer-events-auto group-focus:opacity-100 group-focus:pointer-events-auto focus:opacity-100 focus:pointer-events-auto data-pressed:opacity-100 data-pressed:pointer-events-auto"
                                    >
                                      <Icon icon="ellipsis-h" />
                                    </Button>
                                    <Popover className="flex min-w-max flex-col overflow-y-hidden">
                                      <Menu
                                        aria-label="Collection actions"
                                        onAction={key => {
                                          if (key === 'new-folder') {
                                            showModal(PromptModal, {
                                              title: 'New Folder',
                                              defaultValue: 'My Folder',
                                              submitName: 'Create',
                                              label: 'Name',
                                              selectText: true,
                                              onComplete: name =>
                                                createRequestGroupFetcher.submit({
                                                  organizationId,
                                                  projectId: project._id,
                                                  workspaceId: file.workspace._id,
                                                  parentId: file.workspace._id,
                                                  name,
                                                }),
                                            });
                                          }
                                          if (key === 'new-http') {
                                            createCollectionRequest({ project, workspace: file.workspace, requestType: 'HTTP' });
                                          }
                                          if (key === 'new-event-stream') {
                                            createCollectionRequest({
                                              project,
                                              workspace: file.workspace,
                                              requestType: 'Event Stream',
                                            });
                                          }
                                          if (key === 'new-graphql') {
                                            createCollectionRequest({ project, workspace: file.workspace, requestType: 'GraphQL' });
                                          }
                                          if (key === 'new-grpc') {
                                            createCollectionRequest({ project, workspace: file.workspace, requestType: 'gRPC' });
                                          }
                                          if (key === 'new-websocket') {
                                            createCollectionRequest({
                                              project,
                                              workspace: file.workspace,
                                              requestType: 'WebSocket',
                                            });
                                          }
                                          if (key === 'new-socketio') {
                                            createCollectionRequest({
                                              project,
                                              workspace: file.workspace,
                                              requestType: 'SocketIO',
                                            });
                                          }
                                          if (key === 'import-file') {
                                            setActiveCollectionTarget({ project, workspace: file.workspace });
                                            setIsCollectionImportModalOpen(true);
                                          }
                                          if (key === 'import-curl') {
                                            setActiveCollectionTarget({ project, workspace: file.workspace });
                                            setIsCollectionPasteCurlModalOpen(true);
                                          }
                                        }}
                                        className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                                      >
                                        <MenuItem
                                          id="new-folder"
                                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden"
                                        >
                                          New Folder
                                        </MenuItem>
                                        <MenuItem id="new-http" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">HTTP Request</MenuItem>
                                        <MenuItem id="new-event-stream" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Event Stream Request (SSE)</MenuItem>
                                        <MenuItem id="new-graphql" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">GraphQL Request</MenuItem>
                                        <MenuItem id="new-grpc" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">gRPC Request</MenuItem>
                                        <MenuItem id="new-websocket" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">WebSocket Request</MenuItem>
                                        <MenuItem id="new-socketio" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Socket.IO Request</MenuItem>
                                        <MenuItem id="import-curl" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Import From Curl</MenuItem>
                                        <MenuItem id="import-file" className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden">Import From File</MenuItem>
                                      </Menu>
                                    </Popover>
                                  </MenuTrigger>
                                </div>
                                {isCollectionExpanded &&
                                  (rootNodes.length ? (
                                    <div className="relative flex flex-col">
                                      <div
                                        className="pointer-events-none absolute top-0 bottom-0 w-px -translate-x-1/2 bg-(--hl-sm)"
                                        style={{ left: '33px' }}
                                      />
                                      {renderTreeNodes(file.id, 34)}
                                    </div>
                                  ) : (
                                    <div className="py-1 pl-12 pr-2 text-xs text-(--hl)">Empty collection</div>
                                  ))}
                              </div>
                            );
                          })}
                      </div>
                    )}
                    </div>
                  );
                })}
              </div>
            </div>
            {activeProject && (
              <>
                {isGitProject(activeProject) && (
                  <GitProjectSyncDropdown
                    key={activeProjectGitRepository?._id}
                    gitRepository={activeProjectGitRepository}
                    activeProject={activeProject}
                  />
                )}
                {isLocalProject(activeProject) && !isGitProject(activeProject) && <LocalProjectBar />}
                {isRemoteProject(activeProject) &&
                  (activeWorkspace ? (
                    <SyncDropdown key={activeWorkspace._id} workspace={activeWorkspace} project={activeProject} />
                  ) : (
                    <CloudSyncProjectBar />
                  ))}
              </>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
        <Panel id="pane-one" className="flex flex-col">
          <Outlet />
        </Panel>
      </PanelGroup>
      {isNewProjectModalOpen && (
        <ProjectModal
          isOpen={isNewProjectModalOpen}
          onOpenChange={setIsNewProjectModalOpen}
          storageRules={storageRules}
        />
      )}
      {activeCollectionTarget && isCollectionImportModalOpen && (
        <ImportModal
          onHide={() => setIsCollectionImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={activeCollectionTarget.project.name}
          workspaceName={activeCollectionTarget.workspace.name}
          organizationId={organizationId}
          defaultProjectId={activeCollectionTarget.project._id}
          defaultWorkspaceId={activeCollectionTarget.workspace._id}
        />
      )}
      {activeCollectionTarget && isCollectionPasteCurlModalOpen && (
        <PasteCurlModal
          onImport={req => {
            createCollectionRequest({
              project: activeCollectionTarget.project,
              workspace: activeCollectionTarget.workspace,
              requestType: 'From Curl',
              req,
            });
          }}
          defaultValue=""
          onHide={() => setIsCollectionPasteCurlModalOpen(false)}
        />
      )}
      {folderPasteCurlTarget && isFolderPasteCurlModalOpen && (
        <PasteCurlModal
          onImport={req => {
            createCollectionRequest({
              project: folderPasteCurlTarget.project,
              workspace: folderPasteCurlTarget.workspace,
              requestType: 'From Curl',
              parentId: folderPasteCurlTarget.parentId,
              req,
            });
          }}
          defaultValue=""
          onHide={() => setIsFolderPasteCurlModalOpen(false)}
        />
      )}
    </>
  );
}

export function Component() {
  const matches = useMatches();
  const isProjectHomeRoute = matches.some(
    match => match.id === 'routes/organization.$organizationId.project.$projectId._index',
  );

  if (isProjectHomeRoute) {
    return <Outlet />;
  }

  return <ProjectSidebarShell />;
}

export default Component;
