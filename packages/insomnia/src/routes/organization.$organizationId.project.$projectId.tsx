import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useState } from 'react';
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
import { useProjectDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.delete';
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
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { OrganizationSelect } from '~/ui/components/project/organization-select';
import {
  ProjectSidebarTree,
  type ProjectSidebarTreeAction,
  type ProjectSidebarTreeNode,
} from '~/ui/components/project/project-sidebar-tree';
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
  const [projectSettingsTarget, setProjectSettingsTarget] = useState<(Project & { gitRepository?: GitRepository }) | null>(
    null,
  );
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
  const deleteProjectFetcher = useProjectDeleteActionFetcher();
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

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showModal(AlertModal, {
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

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

  const getProjectActions = (project: Project & { gitRepository?: GitRepository }): ProjectSidebarTreeAction[] => [
    {
      id: 'new-collection',
      label: 'New Collection',
      onAction: () =>
        createWorkspaceFetcher.submit({
          organizationId,
          projectId: project._id,
          scope: 'collection',
          name: 'My Collection',
        }),
    },
    {
      id: 'new-environment',
      label: 'New Environment',
      onAction: () =>
        createWorkspaceFetcher.submit({
          organizationId,
          projectId: project._id,
          scope: 'environment',
          name: 'New Environment',
        }),
    },
    {
      id: 'new-mcp',
      label: 'New MCP Client',
      onAction: () =>
        createWorkspaceFetcher.submit({
          organizationId,
          projectId: project._id,
          scope: 'mcp',
          name: 'MCP Client',
        }),
    },
    {
      id: 'new-document',
      label: 'New Document',
      onAction: () =>
        createWorkspaceFetcher.submit({
          organizationId,
          projectId: project._id,
          scope: 'design',
          name: 'my-spec.yaml',
        }),
    },
    {
      id: 'settings',
      label: 'Settings',
      onAction: () => setProjectSettingsTarget(project),
    },
    {
      id: 'delete',
      label: 'Delete',
      isDanger: true,
      onAction: () =>
        showModal(AskModal, {
          title: 'Delete Project',
          message: isGitProject(project)
            ? `You are deleting the Git project "${project.name}". Deleting this project will not delete the remote repository but all your local changes will be lost. Do you really want to continue?`
            : `You are deleting the project "${project.name}" that may have collaborators. As a result of this, the project will be permanently deleted for every collaborator of the organization. Do you really want to continue?`,
          yesText: 'Delete',
          noText: 'Cancel',
          color: 'danger',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              deleteProjectFetcher.submit({
                organizationId,
                projectId: project._id,
              });
            }
          },
        }),
    },
  ];

  const getWorkspaceActions = (project: Project, file: ProjectSidebarFile): ProjectSidebarTreeAction[] => [
    {
      id: 'open-new-tab',
      label: 'Open in New Tab',
      onAction: () => openFileFromTree(project, file, true),
    },
    {
      id: 'rename',
      label: 'Rename',
      onAction: () =>
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
        }),
    },
    {
      id: 'delete',
      label: 'Delete',
      isDanger: true,
      onAction: () =>
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
        }),
    },
  ];

  const getCollectionActions = (project: Project, file: ProjectSidebarFile): ProjectSidebarTreeAction[] => [
    {
      id: 'new-folder',
      label: 'New Folder',
      onAction: () =>
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
        }),
    },
    {
      id: 'new-http',
      label: 'HTTP Request',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'HTTP' }),
    },
    {
      id: 'new-event-stream',
      label: 'Event Stream Request (SSE)',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'Event Stream' }),
    },
    {
      id: 'new-graphql',
      label: 'GraphQL Request',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'GraphQL' }),
    },
    {
      id: 'new-grpc',
      label: 'gRPC Request',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'gRPC' }),
    },
    {
      id: 'new-websocket',
      label: 'WebSocket Request',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'WebSocket' }),
    },
    {
      id: 'new-socketio',
      label: 'Socket.IO Request',
      onAction: () => createCollectionRequest({ project, workspace: file.workspace, requestType: 'SocketIO' }),
    },
    {
      id: 'import-curl',
      label: 'Import From Curl',
      onAction: () => {
        setActiveCollectionTarget({ project, workspace: file.workspace });
        setIsCollectionPasteCurlModalOpen(true);
      },
    },
    {
      id: 'import-file',
      label: 'Import From File',
      onAction: () => {
        setActiveCollectionTarget({ project, workspace: file.workspace });
        setIsCollectionImportModalOpen(true);
      },
    },
  ];

  const getFolderActions = (
    project: Project,
    file: ProjectSidebarFile,
    node: ProjectSidebarTreeNode,
  ): ProjectSidebarTreeAction[] => {
    const requestGroup = node.doc as RequestGroup;
    return [
      {
        id: 'open-new-tab',
        label: 'Open in New Tab',
        onAction: () => openCollectionTreeNode({ project, workspace: file.workspace, node, withTab: true }),
      },
      {
        id: 'new-folder',
        label: 'New Folder',
        onAction: () =>
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
          }),
      },
      {
        id: 'new-http',
        label: 'HTTP Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace, requestType: 'HTTP', parentId: requestGroup._id }),
      },
      {
        id: 'new-event-stream',
        label: 'Event Stream Request (SSE)',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace,
            requestType: 'Event Stream',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'new-graphql',
        label: 'GraphQL Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace, requestType: 'GraphQL', parentId: requestGroup._id }),
      },
      {
        id: 'new-grpc',
        label: 'gRPC Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace, requestType: 'gRPC', parentId: requestGroup._id }),
      },
      {
        id: 'new-websocket',
        label: 'WebSocket Request',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace,
            requestType: 'WebSocket',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'new-socketio',
        label: 'Socket.IO Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace, requestType: 'SocketIO', parentId: requestGroup._id }),
      },
      {
        id: 'import-curl',
        label: 'Import From Curl',
        onAction: () => {
          setFolderPasteCurlTarget({ project, workspace: file.workspace, parentId: requestGroup._id });
          setIsFolderPasteCurlModalOpen(true);
        },
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        onAction: () =>
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
          }),
      },
      {
        id: 'rename',
        label: 'Rename',
        onAction: () =>
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
                patch: { name },
              }),
          }),
      },
      {
        id: 'run-folder',
        label: 'Run Folder',
        onAction: () =>
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
          ),
      },
      {
        id: 'delete',
        label: 'Delete',
        isDanger: true,
        onAction: () =>
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
          }),
      },
    ];
  };

  const getRequestActions = (
    project: Project,
    file: ProjectSidebarFile,
    node: ProjectSidebarTreeNode,
  ): ProjectSidebarTreeAction[] => {
    const request = node.doc as RequestLike;
    return [
      {
        id: 'open-new-tab',
        label: 'Open in New Tab',
        onAction: () => openCollectionTreeNode({ project, workspace: file.workspace, node, withTab: true }),
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        onAction: () =>
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
          }),
      },
      {
        id: 'rename',
        label: 'Rename',
        onAction: () =>
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
          }),
      },
      {
        id: 'delete',
        label: 'Delete',
        isDanger: true,
        onAction: () =>
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
          }),
      },
    ];
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
              <ProjectSidebarTree
                projects={projects}
                projectFilesByProjectId={projectFilesByProjectId}
                collectionTreeByWorkspaceId={collectionTreeByWorkspaceId}
                workspaceScopeOrder={workspaceScopeOrder}
                workspaceScopeIcon={workspaceScopeIcon}
                expandedProjectIds={expandedProjectIdList}
                expandedCollectionKeys={expandedCollectionKeyList}
                expandedRequestGroupKeys={expandedRequestGroupKeyList}
                activeProjectId={activeProject?._id}
                activeWorkspaceId={workspaceId}
                activeRequestId={requestId}
                activeRequestGroupId={requestGroupId}
                onToggleProjectExpanded={toggleProjectExpanded}
                onToggleCollectionExpanded={toggleCollectionExpanded}
                onToggleRequestGroupExpanded={toggleRequestGroupExpanded}
                onOpenProject={project => navigate(`/organization/${organizationId}/project/${project._id}`)}
                onOpenWorkspace={(project, file, withTab) => openFileFromTree(project, file, withTab)}
                onOpenCollectionNode={(project, file, node, withTab) => {
                  if (!file.workspace) {
                    return;
                  }
                  openCollectionTreeNode({ project, workspace: file.workspace, node, withTab });
                }}
                isPrimaryClickModifier={isPrimaryClickModifier}
                getProjectIcon={project =>
                  isRemoteProject(project)
                    ? 'globe-americas'
                    : isGitProject(project)
                      ? (['fab', 'git-alt'] as unknown as IconProp)
                      : 'laptop'
                }
                getRequestMethodBadgeClass={getRequestMethodBadgeClass}
                getRequestMethodLabel={method => getMethodShortHand({ method } as Request)}
                getProjectActions={getProjectActions}
                getWorkspaceActions={getWorkspaceActions}
                getCollectionActions={getCollectionActions}
                getFolderActions={getFolderActions}
                getRequestActions={getRequestActions}
              />
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
      {projectSettingsTarget && (
        <ProjectModal
          isOpen={Boolean(projectSettingsTarget)}
          onOpenChange={isOpen => {
            if (!isOpen) {
              setProjectSettingsTarget(null);
            }
          }}
          project={projectSettingsTarget}
          gitRepository={projectSettingsTarget.gitRepository}
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
