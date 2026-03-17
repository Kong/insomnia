import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { useEffect, useMemo, useState } from 'react';
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
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';
import { useRequestGroupDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';
import { useRequestGroupDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.duplicate';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { useMockServerGenerateRequestCollectionActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.generate-request-collection';
import { useProjectSidebarTreeMoveActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.sidebar-tree.move';
import { useProjectMoveWorkspaceActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.move-workspace';
import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ExportRequestsModal } from '~/ui/components/modals/export-requests-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { WorkspaceDuplicateModal } from '~/ui/components/modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '~/ui/components/modals/workspace-settings-modal';
import {
  ProjectSidebarTree,
  type ProjectSidebarTreeAction,
  type ProjectSidebarTreeDropPayload,
  type ProjectSidebarTreeNode,
} from '~/ui/components/project/project-sidebar-tree';
import {
  exportGlobalEnvironmentToFile,
  exportMcpClientToFile,
  exportMockServerToFile,
} from '~/ui/components/settings/import-export';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { showToast } from '~/ui/components/toast-notification';
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
  metaSortKey?: number;
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
      metaSortKey: requestGroup.metaSortKey,
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
      metaSortKey: 'metaSortKey' in requestNode ? requestNode.metaSortKey : undefined,
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
  const { organizationId, projectId, workspaceId, requestId, requestGroupId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId?: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const navigate = useNavigate();
  const tabNavigate = useTabNavigate();
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [activeCollectionTarget, setActiveCollectionTarget] = useState<{
    project: Project;
    workspace: Workspace;
  } | null>(null);
  const [isCollectionImportModalOpen, setIsCollectionImportModalOpen] = useState(false);
  const [isCollectionPasteCurlModalOpen, setIsCollectionPasteCurlModalOpen] = useState(false);
  const [workspaceActionTarget, setWorkspaceActionTarget] = useState<{
    project: Project;
    workspace: Workspace;
  } | null>(null);
  const [isWorkspaceImportModalOpen, setIsWorkspaceImportModalOpen] = useState(false);
  const [isWorkspaceExportModalOpen, setIsWorkspaceExportModalOpen] = useState(false);
  const [isWorkspaceDuplicateModalOpen, setIsWorkspaceDuplicateModalOpen] = useState(false);
  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] = useState(false);
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
  const generateCollectionFetcher = useMockServerGenerateRequestCollectionActionFetcher();
  const updateRequestFetcher = useRequestUpdateActionFetcher();
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const moveWorkspaceFetcher = useProjectMoveWorkspaceActionFetcher();
  const moveCollectionNodeFetcher = useProjectSidebarTreeMoveActionFetcher();
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
  const [workspaceOrderByProjectId, setWorkspaceOrderByProjectId] = reactUse.useLocalStorage<Record<string, string[]>>(
    `${organizationId}:project-tree-workspace-order`,
    {},
  );
  const [expandedRequestGroupKeys, setExpandedRequestGroupKeys] = reactUse.useLocalStorage<string[]>(
    `${organizationId}:project-tree-expanded-request-groups`,
    [],
  );
  const [projectOrder, setProjectOrder] = reactUse.useLocalStorage<string[]>(`${organizationId}:project-tree-order`, []);
  const expandedProjectIdList = Array.isArray(expandedProjectIds) ? expandedProjectIds : [];
  const expandedCollectionKeyList = Array.isArray(expandedCollectionKeys) ? expandedCollectionKeys : [];
  const expandedRequestGroupKeyList = Array.isArray(expandedRequestGroupKeys) ? expandedRequestGroupKeys : [];
  const workspaceOrderMap = workspaceOrderByProjectId && typeof workspaceOrderByProjectId === 'object' ? workspaceOrderByProjectId : {};
  const projectOrderList = Array.isArray(projectOrder) ? projectOrder : [];

  const orderedProjects = useMemo(() => {
    const activeProjectIds = new Set(projects.map(project => project._id));
    const normalizedOrder = projectOrderList.filter(projectId => activeProjectIds.has(projectId));
    const missingIds = projects.map(project => project._id).filter(projectId => !normalizedOrder.includes(projectId));
    const fullOrder = [...normalizedOrder, ...missingIds];
    const rankById = new Map(fullOrder.map((projectId, index) => [projectId, index]));

    return projects
      .slice()
      .sort((a, b) => (rankById.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (rankById.get(b._id) ?? Number.MAX_SAFE_INTEGER));
  }, [projectOrderList, projects]);

  useEffect(() => {
    const activeProjectIds = new Set(projects.map(project => project._id));
    const normalizedOrder = projectOrderList.filter(projectId => activeProjectIds.has(projectId));
    const missingIds = projects.map(project => project._id).filter(projectId => !normalizedOrder.includes(projectId));
    const nextOrder = [...normalizedOrder, ...missingIds];

    if (nextOrder.join('|') !== projectOrderList.join('|')) {
      setProjectOrder(nextOrder);
    }
  }, [projectOrderList, projects, setProjectOrder]);

  useEffect(() => {
    const nextOrderMap = { ...workspaceOrderMap };

    orderedProjects.forEach(project => {
      const workspaceIds = (projectFilesByProjectId[project._id] || []).map(file => file.id);
      const existing = (workspaceOrderMap[project._id] || []).filter(id => workspaceIds.includes(id));
      const missing = workspaceIds.filter(id => !existing.includes(id));
      nextOrderMap[project._id] = [...existing, ...missing];
    });

    if (JSON.stringify(nextOrderMap) !== JSON.stringify(workspaceOrderMap)) {
      setWorkspaceOrderByProjectId(nextOrderMap);
    }
  }, [orderedProjects, projectFilesByProjectId, setWorkspaceOrderByProjectId, workspaceOrderMap]);

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

  const getProjectById = (projectId: string) => projects.find(project => project._id === projectId);

  const getStorageLabel = (project: Project) => {
    if (isGitProject(project)) {
      return 'Git';
    }

    if (isRemoteProject(project)) {
      return 'Cloud';
    }

    return 'Local';
  };

  const showCrossProjectMoveConfirmation = ({
    sourceProjectId,
    targetProjectId,
    onConfirm,
  }: {
    sourceProjectId: string;
    targetProjectId: string;
    onConfirm: () => void;
  }) => {
    if (sourceProjectId === targetProjectId) {
      onConfirm();
      return;
    }

    const sourceProject = getProjectById(sourceProjectId);
    const targetProject = getProjectById(targetProjectId);

    if (!sourceProject || !targetProject) {
      return;
    }

    const sourceStorage = getStorageLabel(sourceProject);
    const targetStorage = getStorageLabel(targetProject);

    showModal(AskModal, {
      title: 'Move to Another Project',
      message: `Move this item from ${sourceProject.name} (${sourceStorage}) to ${targetProject.name} (${targetStorage})? This changes where data is stored and may create uncommitted changes.`,
      yesText: 'Move',
      noText: 'Cancel',
      onDone: async isYes => {
        if (isYes) {
          onConfirm();
        }
      },
    });
  };

  const handleProjectReorder = (payload: ProjectSidebarTreeDropPayload) => {
    const currentOrder = orderedProjects.map(project => project._id);
    const sourceIndex = currentOrder.indexOf(payload.source.id);
    const targetIndex = currentOrder.indexOf(payload.target.id);

    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const nextOrder = currentOrder.filter(id => id !== payload.source.id);
    const insertionIndex = payload.position === 'before' ? targetIndex : targetIndex + 1;
    nextOrder.splice(Math.min(insertionIndex, nextOrder.length), 0, payload.source.id);
    setProjectOrder(nextOrder);
  };

  const reorderWorkspaceRows = ({
    sourceWorkspaceId,
    sourceProjectId,
    targetWorkspaceId,
    targetProjectId,
    position,
  }: {
    sourceWorkspaceId: string;
    sourceProjectId: string;
    targetWorkspaceId: string;
    targetProjectId: string;
    position: 'before' | 'after';
  }) => {
    const nextOrderMap = { ...workspaceOrderMap };

    const sourceIds = (projectFilesByProjectId[sourceProjectId] || []).map(file => file.id);
    const targetIds = (projectFilesByProjectId[targetProjectId] || []).map(file => file.id);

    const sourceOrder = (nextOrderMap[sourceProjectId] || sourceIds).filter(id => sourceIds.includes(id));
    const targetOrder = (nextOrderMap[targetProjectId] || targetIds).filter(id => targetIds.includes(id));

    const cleanedSource = sourceOrder.filter(id => id !== sourceWorkspaceId);
    const baseTarget = (sourceProjectId === targetProjectId ? cleanedSource : targetOrder).filter(
      id => id !== sourceWorkspaceId,
    );
    const targetIndex = baseTarget.indexOf(targetWorkspaceId);

    if (targetIndex === -1) {
      return;
    }

    const insertAt = position === 'before' ? targetIndex : targetIndex + 1;
    const nextTarget = baseTarget.slice();
    nextTarget.splice(Math.min(insertAt, nextTarget.length), 0, sourceWorkspaceId);

    nextOrderMap[targetProjectId] = nextTarget;
    if (sourceProjectId !== targetProjectId) {
      nextOrderMap[sourceProjectId] = cleanedSource;
    }

    setWorkspaceOrderByProjectId(nextOrderMap);
  };

  const handleValidTreeDrop = (payload: ProjectSidebarTreeDropPayload) => {
    const { source, target, position } = payload;

    if (source.type === 'project' && target.type === 'project') {
      handleProjectReorder(payload);
      return;
    }

    if (source.type === 'workspace' && target.type === 'project') {
      showCrossProjectMoveConfirmation({
        sourceProjectId: source.projectId,
        targetProjectId: target.projectId,
        onConfirm: () => {
          moveWorkspaceFetcher.submit(organizationId, target.projectId, source.id);
          const sourceIds = (projectFilesByProjectId[source.projectId] || []).map(file => file.id);
          const targetIds = (projectFilesByProjectId[target.projectId] || []).map(file => file.id);
          const nextOrderMap = { ...workspaceOrderMap };
          nextOrderMap[source.projectId] = (nextOrderMap[source.projectId] || sourceIds).filter(id => id !== source.id);
          const targetOrder = (nextOrderMap[target.projectId] || targetIds).filter(id => id !== source.id);
          nextOrderMap[target.projectId] = [...targetOrder, source.id];
          setWorkspaceOrderByProjectId(nextOrderMap);
        },
      });
      return;
    }

    if (source.type === 'workspace' && target.type === 'workspace' && (position === 'before' || position === 'after')) {
      showCrossProjectMoveConfirmation({
        sourceProjectId: source.projectId,
        targetProjectId: target.projectId,
        onConfirm: () => {
          if (source.projectId !== target.projectId) {
            moveWorkspaceFetcher.submit(organizationId, target.projectId, source.id);
          }
          reorderWorkspaceRows({
            sourceWorkspaceId: source.id,
            sourceProjectId: source.projectId,
            targetWorkspaceId: target.id,
            targetProjectId: target.projectId,
            position,
          });
        },
      });
      return;
    }

    if ((source.type === 'request' || source.type === 'request-group') && target.type !== 'project') {
      if (target.type !== 'workspace' && target.type !== 'request' && target.type !== 'request-group') {
        return;
      }
      const sourceType = source.type === 'request' ? 'request' : 'request-group';
      const targetType =
        target.type === 'workspace' ? 'workspace' : target.type === 'request' ? 'request' : 'request-group';

      showCrossProjectMoveConfirmation({
        sourceProjectId: source.projectId,
        targetProjectId: target.projectId,
        onConfirm: () => {
          moveCollectionNodeFetcher.submit({
            organizationId,
            projectId,
            params: {
              sourceId: source.id,
              sourceType,
              targetId: target.id,
              targetType,
              dropPosition: position,
            },
          });
        },
      });
    }
  };

  const handleInvalidTreeDrop = ({ reason }: ProjectSidebarTreeDropPayload & { reason: string }) => {
    showToast({
      icon: 'exclamation-triangle',
      status: 'warning',
      title: 'Move not allowed',
      description: reason,
    });
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

  const getProjectActions = (project: Project): ProjectSidebarTreeAction[] => [
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
  ];

  const getWorkspaceActions = (project: Project, file: ProjectSidebarFile): ProjectSidebarTreeAction[] => {
    const actions: ProjectSidebarTreeAction[] = [
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
    ];

    if (file.scope !== 'mcp') {
      actions.push({
        id: 'import',
        label: 'Import',
        onAction: () => {
          setWorkspaceActionTarget({ project, workspace: file.workspace });
          setIsWorkspaceImportModalOpen(true);
        },
      }, {
        id: 'run-collection',
        label: 'Run Collection',
        onAction: () =>
          navigate(
            `/organization/${organizationId}/project/${project._id}/workspace/${file.workspace._id}/debug/runner?folder=`,
          ),
      }, {
        id: 'duplicate-move',
        label: 'Duplicate / Move',
        onAction: () => {
          setWorkspaceActionTarget({ project, workspace: file.workspace });
          setIsWorkspaceDuplicateModalOpen(true);
        },
      });
    }

    actions.push({
      id: 'export',
      label: 'Export',
      onAction: () => {
        if (file.scope === 'mock-server') {
          return exportMockServerToFile(file.workspace);
        }
        if (file.scope === 'environment') {
          return exportGlobalEnvironmentToFile(file.workspace);
        }
        if (file.scope === 'mcp') {
          return exportMcpClientToFile(file.workspace);
        }

        setWorkspaceActionTarget({ project, workspace: file.workspace });
        setIsWorkspaceExportModalOpen(true);
      },
    });

    if (file.scope === 'mock-server') {
      actions.push({
        id: 'generate-collection',
        label: 'Generate Collection',
        onAction: () =>
          generateCollectionFetcher.submit({
            organizationId,
            projectId: project._id,
            workspaceId: file.workspace._id,
          }),
      });
    }

    actions.push({
      id: 'settings',
      label: 'Settings',
      onAction: () => {
        setWorkspaceActionTarget({ project, workspace: file.workspace });
        setIsWorkspaceSettingsModalOpen(true);
      },
    }, {
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
    });

    return actions;
  };

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
                projects={orderedProjects}
                projectFilesByProjectId={projectFilesByProjectId}
                collectionTreeByWorkspaceId={collectionTreeByWorkspaceId}
                workspaceScopeOrder={workspaceScopeOrder}
                workspaceOrderByProjectId={workspaceOrderMap}
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
                onValidDrop={handleValidTreeDrop}
                onInvalidDrop={handleInvalidTreeDrop}
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
                {isRemoteProject(activeProject) && <CloudSyncProjectBar />}
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
      {workspaceActionTarget && isWorkspaceImportModalOpen && (
        <ImportModal
          onHide={() => setIsWorkspaceImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={workspaceActionTarget.project.name}
          workspaceName={workspaceActionTarget.workspace.name}
          organizationId={organizationId}
          defaultProjectId={workspaceActionTarget.project._id}
          defaultWorkspaceId={workspaceActionTarget.workspace._id}
        />
      )}
      {workspaceActionTarget && isWorkspaceExportModalOpen && (
        <ExportRequestsModal
          workspaceIdToExport={workspaceActionTarget.workspace._id}
          onClose={() => setIsWorkspaceExportModalOpen(false)}
        />
      )}
      {workspaceActionTarget && isWorkspaceDuplicateModalOpen && (
        <WorkspaceDuplicateModal
          onHide={() => setIsWorkspaceDuplicateModalOpen(false)}
          workspace={workspaceActionTarget.workspace}
        />
      )}
      {workspaceActionTarget && isWorkspaceSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={workspaceActionTarget.workspace}
          project={workspaceActionTarget.project}
          onClose={() => setIsWorkspaceSettingsModalOpen(false)}
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
