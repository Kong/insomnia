import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect } from 'react';
import { Button, Heading } from 'react-aria-components';
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
import { isGitProject, isRemoteProject, type Project } from '~/models/project';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { WebSocketRequest } from '~/models/websocket-request';
import { type Workspace, type WorkspaceScope } from '~/models/workspace';
import { useOrganizationLoaderData } from '~/routes/organization';
import { Icon } from '~/ui/components/icon';
import { OrganizationSelect } from '~/ui/components/project/organization-select';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
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

const projectTreeScopes: { scope: WorkspaceScope; label: string; icon: IconProp }[] = [
  { scope: 'collection', label: 'Collections', icon: 'bars' },
  { scope: 'environment', label: 'Environments', icon: 'code' },
  { scope: 'mcp', label: 'MCP Clients', icon: ['fac', 'mcp'] as unknown as IconProp },
  { scope: 'design', label: 'Documents', icon: 'file' },
  { scope: 'mock-server', label: 'Mock Servers', icon: 'server' },
];

export function Component() {
  const matches = useMatches();
  const isProjectHomeRoute = matches.some(
    match => match.id === 'routes/organization.$organizationId.project.$projectId._index',
  );
  const { activeProject, projects, projectFilesByProjectId, collectionTreeByWorkspaceId } =
    useLoaderData() as ProjectRouteLoaderData;
  const { organizationId } = useParams() as { organizationId: string };
  const navigate = useNavigate();
  const tabNavigate = useTabNavigate();
  const organizationData = useOrganizationLoaderData();
  const [expandedProjectIds, setExpandedProjectIds] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-projects`,
    activeProject?._id ? [activeProject._id] : [],
  );
  const [expandedCategoryKeys, setExpandedCategoryKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-categories`,
    [],
  );
  const [expandedCollectionKeys, setExpandedCollectionKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-collections`,
    [],
  );
  const [expandedRequestGroupKeys, setExpandedRequestGroupKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-request-groups`,
    [],
  );

  useEffect(() => {
    if (!activeProject?._id) {
      return;
    }

    setExpandedProjectIds(prev => {
      const previous = prev || [];
      return previous.includes(activeProject._id) ? previous : [activeProject._id, ...previous];
    });
  }, [activeProject?._id, setExpandedProjectIds]);

  const toggleProjectExpanded = (id: string) => {
    setExpandedProjectIds(prev => {
      const previous = prev || [];
      return previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id];
    });
  };

  const toggleCategoryExpanded = (key: string) => {
    setExpandedCategoryKeys(prev => {
      const previous = prev || [];
      return previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key];
    });
  };

  const toggleCollectionExpanded = (key: string) => {
    setExpandedCollectionKeys(prev => {
      const previous = prev || [];
      return previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key];
    });
  };

  const toggleRequestGroupExpanded = (key: string) => {
    setExpandedRequestGroupKeys(prev => {
      const previous = prev || [];
      return previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key];
    });
  };

  const openFileFromTree = (project: Project, file: ProjectSidebarFile, withTab?: boolean) => {
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

  if (isProjectHomeRoute) {
    return <Outlet />;
  }

  return (
    <PanelGroup
      autoSaveId="insomnia-project-shell"
      id="project-shell"
      className="new-sidebar h-full w-full text-(--color-font)"
      direction="horizontal"
    >
      <Panel
        id="project-sidebar"
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
              <Heading className="text-xs uppercase">Projects ({projects.length})</Heading>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {projects.map(project => {
                const isProjectExpanded = Boolean(expandedProjectIds?.includes(project._id));
                const isActiveProject = project._id === activeProject?._id;
                const files = projectFilesByProjectId[project._id] || [];

                return (
                  <div key={project._id} className="flex flex-col">
                    <div className="group flex items-center gap-1 px-2 py-1">
                      <Button
                        aria-label={`${isProjectExpanded ? 'Collapse' : 'Expand'} ${project.name}`}
                        onPress={() => toggleProjectExpanded(project._id)}
                        className="flex h-5 w-5 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                      >
                        <Icon icon={isProjectExpanded ? 'chevron-down' : 'chevron-right'} className="w-3" />
                      </Button>
                      <Button
                        aria-label={`Open project ${project.name}`}
                        onPress={() => navigate(`/organization/${organizationId}/project/${project._id}`)}
                        className={`flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-1 text-left text-sm transition-colors ${
                          isActiveProject
                            ? 'bg-(--hl-sm) text-(--color-font)'
                            : 'text-(--hl) hover:bg-(--hl-xs) hover:text-(--color-font)'
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
                        <span className="truncate">{project.name}</span>
                      </Button>
                    </div>
                    {isProjectExpanded && (
                      <div className="mb-1 flex flex-col">
                        {projectTreeScopes.map(scopeGroup => {
                          const categoryKey = `${project._id}:${scopeGroup.scope}`;
                          const isCategoryExpanded = Boolean(expandedCategoryKeys?.includes(categoryKey));
                          const scopedFiles = files
                            .filter(file => file.scope === scopeGroup.scope)
                            .sort((a, b) => a.name.localeCompare(b.name));

                          return (
                            <div key={categoryKey} className="flex flex-col">
                              <div className="group flex items-center gap-1 py-0.5 pl-6 pr-2">
                                <Button
                                  aria-label={`${isCategoryExpanded ? 'Collapse' : 'Expand'} ${scopeGroup.label}`}
                                  onPress={() => toggleCategoryExpanded(categoryKey)}
                                  className="flex h-4 w-4 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                                >
                                  <Icon icon={isCategoryExpanded ? 'chevron-down' : 'chevron-right'} className="w-2.5" />
                                </Button>
                                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-0.5 text-(--hl)">
                                  <Icon icon={scopeGroup.icon} className="w-3.5" />
                                  <span className="truncate text-xs">{scopeGroup.label}</span>
                                  <span className="ml-auto text-xs text-(--hl-md)">{scopedFiles.length}</span>
                                </div>
                              </div>
                              {isCategoryExpanded && (
                                <div className="flex flex-col">
                                  {scopedFiles.map(file => {
                                    if (scopeGroup.scope !== 'collection') {
                                      return (
                                        <Button
                                          key={`${project._id}:${file.id}`}
                                          aria-label={`Open ${file.name}`}
                                          onPress={e => openFileFromTree(project, file, isPrimaryClickModifier(e))}
                                          className="ml-12 mr-2 rounded-xs px-2 py-1 text-left text-xs text-(--hl) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font)"
                                        >
                                          <span className="truncate">{file.name}</span>
                                        </Button>
                                      );
                                    }

                                    const collectionKey = `${project._id}:${file.id}`;
                                    const isCollectionExpanded = Boolean(expandedCollectionKeys?.includes(collectionKey));
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
                                          const isRequestGroupExpanded = Boolean(
                                            expandedRequestGroupKeys?.includes(requestGroupKey),
                                          );
                                          const hasChildren = collectionTreeNodes.some(
                                            childNode => childNode.parentId === node._id,
                                          );

                                          if (node.nodeType === 'request-group') {
                                            return (
                                              <div key={requestGroupKey} className="flex flex-col">
                                                <div
                                                  className="group flex items-center gap-1 py-0.5 pr-2"
                                                  style={{ paddingLeft: `${depth}px` }}
                                                >
                                                  <Button
                                                    aria-label={`${isRequestGroupExpanded ? 'Collapse' : 'Expand'} ${node.name}`}
                                                    onPress={() => toggleRequestGroupExpanded(requestGroupKey)}
                                                    className="flex h-4 w-4 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                                                  >
                                                    <Icon
                                                      icon={isRequestGroupExpanded ? 'chevron-down' : 'chevron-right'}
                                                      className="w-2.5"
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
                                                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-0.5 text-left text-xs text-(--hl) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font)"
                                                  >
                                                    <Icon icon="folder" className="w-3" />
                                                    <span className="truncate">{node.name}</span>
                                                  </Button>
                                                </div>
                                                {isRequestGroupExpanded && hasChildren && (
                                                  <div className="flex flex-col">{renderTreeNodes(node._id, depth + 16)}</div>
                                                )}
                                              </div>
                                            );
                                          }

                                          return (
                                            <Button
                                              key={requestGroupKey}
                                              aria-label={`Open request ${node.name}`}
                                              onPress={e =>
                                                openCollectionTreeNode({
                                                  project,
                                                  workspace: file.workspace,
                                                  node,
                                                  withTab: isPrimaryClickModifier(e),
                                                })
                                              }
                                              className="mr-2 rounded-xs px-2 py-0.5 text-left text-xs text-(--hl) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font)"
                                              style={{ marginLeft: `${depth + 18}px` }}
                                            >
                                              <span className="truncate">
                                                {node.requestMethod ? `${node.requestMethod} ` : ''}
                                                {node.name}
                                              </span>
                                            </Button>
                                          );
                                        });
                                    };

                                    return (
                                      <div key={collectionKey} className="flex flex-col">
                                        <div className="group flex items-center gap-1 py-0.5 pl-12 pr-2">
                                          <Button
                                            aria-label={`${isCollectionExpanded ? 'Collapse' : 'Expand'} ${file.name}`}
                                            onPress={() => toggleCollectionExpanded(collectionKey)}
                                            className="flex h-4 w-4 items-center justify-center rounded-xs text-(--hl) transition-colors hover:bg-(--hl-xs)"
                                          >
                                            <Icon
                                              icon={isCollectionExpanded ? 'chevron-down' : 'chevron-right'}
                                              className="w-2.5"
                                            />
                                          </Button>
                                          <Button
                                            aria-label={`Open ${file.name}`}
                                            onPress={e => openFileFromTree(project, file, isPrimaryClickModifier(e))}
                                            className="flex min-w-0 flex-1 items-center gap-2 rounded-xs px-2 py-0.5 text-left text-xs text-(--hl) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font)"
                                          >
                                            <Icon icon="bars" className="w-3.5" />
                                            <span className="truncate">{file.name}</span>
                                            <span className="ml-auto text-[10px] text-(--hl-md)">{rootNodes.length}</span>
                                          </Button>
                                        </div>
                                        {isCollectionExpanded && (
                                          <div className="flex flex-col">{renderTreeNodes(file.id, 66)}</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
        </div>
      </Panel>
      <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
      <Panel id="project-content" className="flex flex-col">
        <Outlet />
      </Panel>
    </PanelGroup>
  );
}

export default Component;
