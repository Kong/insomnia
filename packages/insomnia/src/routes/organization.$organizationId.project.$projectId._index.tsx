import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import { getLearningFeature } from 'insomnia-api';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Button,
  GridList,
  GridListItem,
  Heading,
  Input,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useFetchers, useLoaderData, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { logout } from '~/account/session';
import { parseApiSpec, type ParsedApiSpec } from '~/common/api-specs';
import {
  DASHBOARD_SORT_ORDERS,
  type DashboardSortOrder,
  dashboardSortOrderName,
  DEFAULT_SIDEBAR_SIZE,
  getAppWebsiteBaseURL,
} from '~/common/constants';
import { database } from '~/common/database';
import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '~/common/get-workspace-label';
import { fuzzyMatchAll, isNotNullOrUndefined } from '~/common/misc';
import { descendingNumberSort, sortMethodMap } from '~/common/sorting';
import * as models from '~/models';
import { userSession } from '~/models';
import type { ApiSpec } from '~/models/api-spec';
import type { GitRepository } from '~/models/git-repository';
import type { GrpcRequest } from '~/models/grpc-request';
import { sortProjects } from '~/models/helpers/project';
import type { McpRequest } from '~/models/mcp-request';
import type { MockServer } from '~/models/mock-server';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId } from '~/models/organization';
import {
  getProjectStorageTypeLabel,
  isGitProject,
  isLocalProject,
  isRemoteProject,
  type Project,
} from '~/models/project';
import type { Request } from '~/models/request';
import type { RequestGroup } from '~/models/request-group';
import type { SocketIORequest } from '~/models/socket-io-request';
import type { WebSocketRequest } from '~/models/websocket-request';
import { isDesign, type Workspace, type WorkspaceScope } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
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
import { useProjectDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.delete';
import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent, trackOnceDaily } from '~/ui/analytics';
import { AvatarGroup } from '~/ui/components/avatar';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { SyncDropdown } from '~/ui/components/dropdowns/sync-dropdown';
import { WorkspaceCardDropdown } from '~/ui/components/dropdowns/workspace-card-dropdown';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ExportRequestsModal } from '~/ui/components/modals/export-requests-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';
import { PasteCurlModal } from '~/ui/components/modals/paste-curl-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import { WorkspaceDuplicateModal } from '~/ui/components/modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '~/ui/components/modals/workspace-settings-modal';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { NoSelectedProjectView } from '~/ui/components/panes/no-selected-project-view';
import { ProjectEmptyView } from '~/ui/components/project/project-empty-view';
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
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';
import { TimeFromNow } from '~/ui/components/time-from-now';
import { showResourceNotFoundToast, showToast } from '~/ui/components/toast-notification';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { trackTempProjectOpened } from '~/ui/temp-segment-tracking';
import { isPrimaryClickModifier } from '~/ui/utils';
import { invariant } from '~/utils/invariant';

export interface InsomniaFile {
  id: string;
  name: string;
  remoteId?: string;
  scope: WorkspaceScope | 'unsynced';
  label: 'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment' | 'MCP Client';
  created: number;
  lastModifiedTimestamp: number;
  branch?: string;
  lastCommit?: string;
  version?: string;
  oasFormat?: string;
  mockServer?: MockServer;
  workspace?: Workspace;
  apiSpec?: ApiSpec;
  hasUncommittedChanges?: boolean;
  hasUnpushedChanges?: boolean;
  gitFilePath?: string | null;
}

export interface ProjectLoaderData {
  localFiles: InsomniaFile[];
  projectFilesByProjectId: Record<string, InsomniaFile[]>;
  collectionTreeByWorkspaceId: Record<string, CollectionTreeNode[]>;
  allFilesCount: number;
  documentsCount: number;
  environmentsCount: number;
  collectionsCount: number;
  mockServersCount: number;
  mcpClientsCount: number;
  projectsCount: number;
  activeProject?: Project;
  activeProjectGitRepository?: GitRepository;
  projects: (Project & { gitRepository?: GitRepository })[];
  learningFeaturePromise?: Promise<LearningFeature>;
  remoteFilesPromise?: Promise<InsomniaFile[]>;
  projectsSyncStatusPromise?: Promise<Record<string, boolean>>;
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

/**
 * Get all projects for an organization with their associated git repositories
 */
export async function getProjectsWithGitRepositories({
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

async function getAllLocalFiles({ projectId }: { projectId: string }) {
  const projectWorkspaces = await models.workspace.findByParentId(projectId);
  const [workspaceMetas, apiSpecs, mockServers] = await Promise.all([
    database.find<WorkspaceMeta>(models.workspaceMeta.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<ApiSpec>(models.apiSpec.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
    database.find<MockServer>(models.mockServer.type, {
      parentId: {
        $in: projectWorkspaces.map(w => w._id),
      },
    }),
  ]);

  const gitRepositories = await database.find<GitRepository>(models.gitRepository.type, {
    parentId: {
      $in: workspaceMetas.map(wm => wm.gitRepositoryId).filter(isNotNullOrUndefined),
    },
  });

  const files: InsomniaFile[] = projectWorkspaces.map(workspace => {
    const apiSpec = apiSpecs.find(spec => spec.parentId === workspace._id);
    const mockServer = mockServers.find(mock => mock.parentId === workspace._id);
    let spec: ParsedApiSpec['contents'] = null;
    let specFormat: ParsedApiSpec['format'] = null;
    let specFormatVersion: ParsedApiSpec['formatVersion'] = null;
    if (apiSpec) {
      try {
        const result = parseApiSpec(apiSpec.contents);
        spec = result.contents;
        specFormat = result.format;
        specFormatVersion = result.formatVersion;
      } catch {
        // Assume there is no spec
        // TODO: Check for parse errors if it's an invalid spec
      }
    }
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);
    const gitRepository = gitRepositories.find(gr => gr._id === workspaceMeta?.gitRepositoryId);

    const lastActiveBranch = gitRepository?.cachedGitRepositoryBranch;

    const lastCommitAuthor = gitRepository?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = isDesign(workspace) ? apiSpec?.modified || 0 : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      modifiedLocally,
      gitRepository?.cachedGitLastCommitTime,
    ];

    const lastModifiedTimestamp = lastModifiedFrom.filter(isNotNullOrUndefined).sort(descendingNumberSort)[0];

    const hasUnsavedChanges = Boolean(
      isDesign(workspace) &&
        gitRepository?.cachedGitLastCommitTime &&
        modifiedLocally > gitRepository?.cachedGitLastCommitTime,
    );

    const specVersion = spec?.info?.version ? String(spec?.info?.version) : '';

    return {
      id: workspace._id,
      name: workspace.name,
      scope: workspace.scope,
      label: scopeToLabelMap[workspace.scope],
      created: workspace.created,
      lastModifiedTimestamp:
        (hasUnsavedChanges && modifiedLocally) || gitRepository?.cachedGitLastCommitTime || lastModifiedTimestamp,
      branch: lastActiveBranch || '',
      lastCommit:
        hasUnsavedChanges && gitRepository?.cachedGitLastCommitTime && lastCommitAuthor ? `by ${lastCommitAuthor}` : '',
      version: specVersion ? `${specVersion?.startsWith('v') ? '' : 'v'}${specVersion}` : '',
      oasFormat: specFormat ? `${specFormat === 'openapi' ? 'OpenAPI' : 'Swagger'} ${specFormatVersion || ''}` : '',
      mockServer,
      apiSpec,
      workspace,
      hasUncommittedChanges: workspaceMeta?.hasUncommittedChanges,
      hasUnpushedChanges: workspaceMeta?.hasUnpushedChanges,
      gitFilePath: workspaceMeta?.gitFilePath,
    };
  });
  return files;
}

async function getAllRemoteFiles({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  try {
    const project = await models.project.getById(projectId);

    const remoteId = project?.remoteId;
    if (!remoteId) {
      return [];
    }

    console.log(
      '[getAllRemoteFiles] start fetching remote backend workspaces for project',
      projectId,
      `remoteId: ${remoteId}`,
    );

    const vcs = VCSInstance();

    const [allPulledBackendProjectsForRemoteId, allFetchedRemoteBackendProjectsForRemoteId] = await Promise.all([
      vcs.localBackendProjects().then(projects => projects.filter(p => p.id === remoteId)),
      // Remote backend projects are fetched from the backend since they are not stored locally
      vcs.remoteBackendProjects({ teamId: organizationId, teamProjectId: remoteId }),
    ]);
    console.log(
      `[getAllRemoteFiles] found allPulledBackendProjectsForRemoteId: ${allPulledBackendProjectsForRemoteId.length} and allFetchedRemoteBackendProjectsForRemoteId: ${allFetchedRemoteBackendProjectsForRemoteId.length} for remoteId: ${remoteId}`,
    );
    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(models.workspace.type, {
      _id: {
        $in: [...allPulledBackendProjectsForRemoteId, ...allFetchedRemoteBackendProjectsForRemoteId].map(
          p => p.rootDocumentId,
        ),
      },
      parentId: project._id,
    });
    console.log(`[getAllRemoteFiles] found workspacesWithBackendProjects: ${workspacesWithBackendProjects.length}`);
    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId.filter(
      p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId),
    );
    console.log(`[getAllRemoteFiles] get ${backendProjectsToPull.length} unsynced files`);
    return backendProjectsToPull.map(backendProject => {
      const file: InsomniaFile = {
        id: backendProject.rootDocumentId,
        name: backendProject.name,
        scope: 'unsynced',
        label: 'Unsynced',
        remoteId: backendProject.id,
        created: 0,
        lastModifiedTimestamp: 0,
      };

      return file;
    });
  } catch (e) {
    console.warn('Failed to load backend projects', e);
  }

  return [];
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

interface LearningFeature {
  active: boolean;
  title: string;
  message: string;
  cta: string;
  url: string;
}

const getInsomniaLearningFeature = async (fallbackLearningFeature: LearningFeature) => {
  let learningFeature = fallbackLearningFeature;
  const lastFetchedString = window.localStorage.getItem('learning-feature-last-fetch');
  const lastFetched = lastFetchedString ? Number.parseInt(lastFetchedString, 10) : 0;
  const oneDay = 86_400_000;
  const hasOneDayPassedSinceLastFetch = Date.now() - lastFetched > oneDay;
  const wasDismissed = window.localStorage.getItem('learning-feature-dismissed');
  const wasNotDismissedAndOneDayHasPassed = !wasDismissed && hasOneDayPassedSinceLastFetch;
  if (wasNotDismissedAndOneDayHasPassed) {
    try {
      learningFeature = await getLearningFeature();
      window.localStorage.setItem('learning-feature-last-fetch', Date.now().toString());
    } catch {
      console.log('[project] Could not fetch learning feature data.');
    }
  }
  return learningFeature;
};

const checkSingleProjectSyncStatus = async (projectId: string) => {
  const projectWorkspaces = await models.workspace.findByParentId(projectId);
  const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, {
    parentId: {
      $in: projectWorkspaces.map(w => w._id),
    },
  });
  return workspaceMetas.some(item => item.hasUncommittedChanges || item.hasUnpushedChanges);
};

const CheckAllProjectSyncStatus = async (projects: Project[]) => {
  const taskList = projects.map(project => checkSingleProjectSyncStatus(project._id));
  const res = await Promise.all(taskList);
  const obj: Record<string, boolean> = {};
  projects.forEach((project, index) => {
    obj[project._id] = res[index];
  });
  return obj;
};

export async function clientLoader({ params }: LoaderFunctionArgs) {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  const { id: sessionId } = await userSession.getOrCreate();
  const fallbackLearningFeature = {
    active: false,
    title: '',
    message: '',
    cta: '',
    url: '',
  };
  if (!projectId) {
    return {
      localFiles: [],
      projectFilesByProjectId: {},
      collectionTreeByWorkspaceId: {},
      allFilesCount: 0,
      documentsCount: 0,
      environmentsCount: 0,
      collectionsCount: 0,
      mockServersCount: 0,
      mcpClientsCount: 0,
      projectsCount: 0,
      activeProject: undefined,
      projects: [],
    };
  }

  if (!sessionId) {
    await logout();
    throw redirect(href('/auth/login'));
  }

  invariant(projectId, 'projectId parameter is required');

  const project = await models.project.getById(projectId);
  console.log('[project loader] Loading project:', project?.name, projectId);
  const [localFiles, organizationProjects = []] = await Promise.all([
    getAllLocalFiles({ projectId }),
    getProjectsWithGitRepositories({ organizationId }),
  ]);
  const projectFilesByProjectId = Object.fromEntries(
    await Promise.all(
      organizationProjects.map(async organizationProject => {
        const files =
          organizationProject._id === projectId
            ? localFiles
            : await getAllLocalFiles({ projectId: organizationProject._id });

        return [organizationProject._id, files] as const;
      }),
    ),
  );
  const collectionWorkspaceIds = Object.values(projectFilesByProjectId)
    .flat()
    .filter(file => file.scope === 'collection')
    .map(file => file.id);
  const collectionTreeByWorkspaceId = await getCollectionTreeByWorkspaceId({ collectionWorkspaceIds });

  const remoteFilesPromise = getAllRemoteFiles({ projectId, organizationId });
  const learningFeaturePromise = getInsomniaLearningFeature(fallbackLearningFeature);

  const projects = sortProjects(organizationProjects);

  const projectsSyncStatusPromise = CheckAllProjectSyncStatus(projects);

  const activeProjectGitRepository =
    project && isGitProject(project) ? await models.gitRepository.getById(project.gitRepositoryId || '') : null;

  return {
    localFiles,
    projectFilesByProjectId,
    collectionTreeByWorkspaceId,
    learningFeaturePromise,
    remoteFilesPromise,
    projects,
    projectsCount: organizationProjects.length,
    activeProject: project,
    activeProjectGitRepository,
    allFilesCount: localFiles.length,
    environmentsCount: localFiles.filter(file => file.scope === 'environment').length,
    documentsCount: localFiles.filter(file => file.scope === 'design').length,
    collectionsCount: localFiles.filter(file => file.scope === 'collection').length,
    mockServersCount: localFiles.filter(file => file.scope === 'mock-server').length,
    mcpClientsCount: localFiles.filter(file => file.scope === 'mcp').length,
    projectsSyncStatusPromise,
  };
}

export function useProjectIndexLoaderData() {
  return useRouteLoaderData<typeof clientLoader>('routes/organization.$organizationId.project.$projectId._index');
}

const Component = () => {
  const {
    localFiles,
    projectFilesByProjectId,
    collectionTreeByWorkspaceId,
    activeProject,
    activeProjectGitRepository,
    projects,
    learningFeaturePromise,
    remoteFilesPromise,
    projectsSyncStatusPromise,
  } = useLoaderData() as ProjectLoaderData;
  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = reactUse.useLocalStorage(
    'learning-feature-dismissed',
    '',
  );
  const { organizationId, projectId, workspaceId, requestId, requestGroupId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId?: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const [learningFeature] = useLoaderDeferData<LearningFeature>(learningFeaturePromise);
  const [remoteFiles] = useLoaderDeferData<InsomniaFile[]>(remoteFilesPromise, projectId);

  useEffect(() => {
    if (activeProject?.remoteId && remoteFiles) {
      console.log('[remote files] remote files loaded for project ui', remoteFiles.length);
    }
  }, [activeProject?.remoteId, remoteFiles]);
  const [checkAllProjectSyncStatus] = useLoaderDeferData<Record<string, boolean>>(projectsSyncStatusPromise, projectId);

  const allFiles = useMemo(() => {
    return remoteFiles ? [...localFiles, ...remoteFiles] : localFiles;
  }, [localFiles, remoteFiles]);

  const { userSession } = useRootLoaderData()!;
  const pullFileFetcher = useInsomniaSyncPullRemoteFileActionFetcher();
  const loadingBackendProjects = useFetchers()
    .filter(
      fetcher => fetcher.formAction === `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
    )
    .map(f => f.formData?.get('backendProjectId'));

  const organizationData = useOrganizationLoaderData();
  const { presence } = useInsomniaEventStreamContext();
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const deleteProjectFetcher = useProjectDeleteActionFetcher();
  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const createRequestFetcher = useRequestNewActionFetcher();
  const createRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const updateRequestFetcher = useRequestUpdateActionFetcher();
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const moveWorkspaceFetcher = useProjectMoveWorkspaceActionFetcher();
  const moveCollectionNodeFetcher = useProjectSidebarTreeMoveActionFetcher();
  const updateRequestGroupFetcher = useRequestGroupUpdateActionFetcher();
  const duplicateRequestGroupFetcher = useRequestGroupDuplicateActionFetcher();
  const deleteRequestGroupFetcher = useRequestGroupDeleteActionFetcher();
  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const generateCollectionFetcher = useMockServerGenerateRequestCollectionActionFetcher();
  const { billing } = useOrganizationPermissions();

  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  useEffect(() => {
    if (deleteProjectFetcher.data && deleteProjectFetcher.data.error && deleteProjectFetcher.state === 'idle') {
      showModal(AlertModal, {
        title: 'Could not delete project',
        message: deleteProjectFetcher.data.error,
      });
    }
  }, [deleteProjectFetcher.data, deleteProjectFetcher.state]);

  // TODO(INS-1912): Remove in 12.5
  useEffect(() => {
    if (projectId) {
      trackTempProjectOpened(projectId);
    }
  }, [projectId]);

  const { storagePromise } = storageRuleFetcher.data || {};

  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);
  const projectWorkspaces = projectFilesByProjectId[activeProject?._id || ''] ?? [];
  const activeWorkspace =
    (workspaceId ? projectWorkspaces.find(file => file.id === workspaceId)?.workspace : null) ||
    projectWorkspaces.find(file => file.scope === 'collection')?.workspace ||
    projectWorkspaces.find(file => file.workspace)?.workspace ||
    null;

  const [workspaceListFilter, setWorkspaceListFilter] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-filter`,
    '',
  );
  const [workspaceListSortOrder, setWorkspaceListSortOrder] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-sort-order`,
    'modified-desc',
  );
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
  const [importModalType, setImportModalType] = useState<'file' | 'clipboard' | 'uri' | null>(null);
  const [collectionActionTarget, setCollectionActionTarget] = useState<{
    project: Project & { gitRepository?: GitRepository };
    workspace: Workspace;
  } | null>(null);
  const [workspaceActionTarget, setWorkspaceActionTarget] = useState<{
    project: Project & { gitRepository?: GitRepository };
    file: InsomniaFile;
    workspace: Workspace;
  } | null>(null);
  const [isWorkspaceImportModalOpen, setIsWorkspaceImportModalOpen] = useState(false);
  const [isWorkspaceExportModalOpen, setIsWorkspaceExportModalOpen] = useState(false);
  const [isWorkspaceDuplicateModalOpen, setIsWorkspaceDuplicateModalOpen] = useState(false);
  const [isWorkspaceSettingsModalOpen, setIsWorkspaceSettingsModalOpen] = useState(false);
  const [isCollectionImportModalOpen, setIsCollectionImportModalOpen] = useState(false);
  const [isCollectionPasteCurlModalOpen, setIsCollectionPasteCurlModalOpen] = useState(false);
  const [folderPasteCurlTarget, setFolderPasteCurlTarget] = useState<{
    project: Project & { gitRepository?: GitRepository };
    workspace: Workspace;
    parentId: string;
  } | null>(null);
  const [isFolderPasteCurlModalOpen, setIsFolderPasteCurlModalOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectSettingsTarget, setProjectSettingsTarget] = useState<
    (Project & { gitRepository?: GitRepository }) | null
  >(null);
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  const isUserOwner =
    organization && userSession.accountId && isOwnerOfOrganization({ organization, accountId: userSession.accountId });
  const isPersonalOrg = organization && isPersonalOrganization(organization);

  const tabNavigate = useTabNavigate();

  const projectFilesWithRemoteByProjectId = useMemo(() => {
    const filesByProjectId = { ...projectFilesByProjectId };

    if (activeProject?._id) {
      const currentProjectFiles = filesByProjectId[activeProject._id] || [];
      const existingIds = new Set(currentProjectFiles.map(file => file.id));
      const unsyncedFiles = (remoteFiles || []).filter(file => !existingIds.has(file.id));
      filesByProjectId[activeProject._id] = [...currentProjectFiles, ...unsyncedFiles];
    }

    return filesByProjectId;
  }, [projectFilesByProjectId, activeProject?._id, remoteFiles]);

  const filteredFiles = allFiles
    .filter(workspace => {
      if (!workspaceListFilter) return true;
      const filterStr = workspaceListFilter.toLowerCase();
      const props = [
        workspace.name?.toLowerCase() || '',
        workspace.branch?.toLowerCase() || '',
        workspace.oasFormat?.toLowerCase() || '',
      ];
      const result = fuzzyMatchAll(filterStr, props, { splitSpace: true, loose: true });
      return Boolean(result?.indexes);
    })
    .sort((a, b) => sortMethodMap[workspaceListSortOrder as DashboardSortOrder](a, b));

  const filesWithPresence = filteredFiles
    .map(file => {
      const workspacePresence = presence
        .filter(p => p.project === activeProject?.remoteId && p.file === file.id)
        .filter(p => p.acct !== userSession.accountId)
        .map(user => {
          return {
            key: user.acct,
            alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
            src: user.avatar,
          };
        });
      return {
        ...file,
        loading:
          loadingBackendProjects.includes(file.remoteId) ||
          (pullFileFetcher.formData?.get('backendProjectId') &&
            pullFileFetcher.formData?.get('backendProjectId') === file.remoteId),
        presence: workspacePresence,
      };
    })
    .map(file => ({
      ...file,
      action: (withTab?: boolean) => {
        // hack to workaround gridlist not have access to workspace scope
        if (file.scope === 'unsynced') {
          if (activeProject?.remoteId && file.remoteId) {
            return pullFileFetcher.submit({
              backendProjectId: file.remoteId,
              remoteId: activeProject.remoteId,
              organizationId,
            });
          }

          return;
        }

        if (!activeProject || !file.workspace) {
          showResourceNotFoundToast('Workspace not found');
          return;
        }

        tabNavigate(
          {
            organization: organizationId,
            project: activeProject,
            workspace: file.workspace,
            item: file.workspace,
          },
          {
            withTab,
            shouldNavigate: true,
          },
        );

        return;
      },
    }));

  const projectsWithPresence = projects.map(project => {
    const projectPresence = presence
      .filter(p => p.project === project.remoteId)
      .filter(p => p.acct !== userSession.accountId)
      .map(user => {
        return {
          key: user.acct,
          alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
          src: user.avatar,
        };
      });
    return {
      ...project,
      presence: projectPresence,
      hasUncommittedOrUnpushedChanges:
        checkAllProjectSyncStatus?.[project._id] ||
        project.gitRepository?.hasUncommittedChanges ||
        project.gitRepository?.hasUnpushedChanges,
    };
  });

  const orderedProjectsWithPresence = useMemo(() => {
    const activeProjectIds = new Set(projectsWithPresence.map(project => project._id));
    const normalizedOrder = projectOrderList.filter(projectId => activeProjectIds.has(projectId));
    const missingIds = projectsWithPresence
      .map(project => project._id)
      .filter(projectId => !normalizedOrder.includes(projectId));
    const fullOrder = [...normalizedOrder, ...missingIds];
    const rankById = new Map(fullOrder.map((projectId, index) => [projectId, index]));

    return projectsWithPresence
      .slice()
      .sort((a, b) => (rankById.get(a._id) ?? Number.MAX_SAFE_INTEGER) - (rankById.get(b._id) ?? Number.MAX_SAFE_INTEGER));
  }, [projectOrderList, projectsWithPresence]);

  useEffect(() => {
    const activeProjectIds = new Set(projectsWithPresence.map(project => project._id));
    const normalizedOrder = projectOrderList.filter(projectId => activeProjectIds.has(projectId));
    const missingIds = projectsWithPresence
      .map(project => project._id)
      .filter(projectId => !normalizedOrder.includes(projectId));
    const nextOrder = [...normalizedOrder, ...missingIds];

    if (nextOrder.join('|') !== projectOrderList.join('|')) {
      setProjectOrder(nextOrder);
    }
  }, [projectOrderList, projectsWithPresence, setProjectOrder]);

  useEffect(() => {
    const nextOrderMap = { ...workspaceOrderMap };

    orderedProjectsWithPresence.forEach(project => {
      const workspaceIds = (projectFilesWithRemoteByProjectId[project._id] || []).map(file => file.id);
      const existing = (workspaceOrderMap[project._id] || []).filter(id => workspaceIds.includes(id));
      const missing = workspaceIds.filter(id => !existing.includes(id));
      nextOrderMap[project._id] = [...existing, ...missing];
    });

    if (JSON.stringify(nextOrderMap) !== JSON.stringify(workspaceOrderMap)) {
      setWorkspaceOrderByProjectId(nextOrderMap);
    }
  }, [orderedProjectsWithPresence, projectFilesWithRemoteByProjectId, setWorkspaceOrderByProjectId, workspaceOrderMap]);

  const navigate = useNavigate();

  const [newWorkspaceModalState, setNewWorkspaceModalState] = useState<{
    scope: WorkspaceScope;
    isOpen: boolean;
  } | null>({
    scope: 'collection',
    isOpen: false,
  });

  const createNewCollection = () => setNewWorkspaceModalState({ scope: 'collection', isOpen: true });
  const createNewDocument = () => setNewWorkspaceModalState({ scope: 'design', isOpen: true });
  const createNewMockServer = () =>
    canCreateMockServer && setNewWorkspaceModalState({ scope: 'mock-server', isOpen: true });
  const createNewGlobalEnvironment = () => setNewWorkspaceModalState({ scope: 'environment', isOpen: true });
  const createNewMcpClient = () => setNewWorkspaceModalState({ scope: 'mcp', isOpen: true });

  const createNewCollectionWithRequest = () => {
    if (!activeProject) {
      return;
    }

    createNewWorkspaceFetcher.submit({
      organizationId,
      projectId,
      name: 'My first collection',
      scope: 'collection',
      withRequest: true,
    });
  };

  const canCreateMockServer = activeProject?._id;

  const createInProjectActionList: {
    id: string;
    name: string;
    icon: IconProp;
    action: () => void;
  }[] = [
    {
      id: 'new-collection',
      name: 'Request collection',
      icon: 'bars',
      action: createNewCollection,
    },
    {
      id: 'new-document',
      name: 'Design document',
      icon: 'file',
      action: createNewDocument,
    },
    {
      id: 'new-mcp-client',
      name: 'MCP Client',
      icon: ['fac', 'mcp'] as unknown as IconProp,
      action: createNewMcpClient,
    },
    ...(canCreateMockServer
      ? [
          {
            id: 'new-mock-server',
            name: 'Mock Server',
            icon: 'server' as IconName,
            action: createNewMockServer,
          },
        ]
      : []),
    {
      id: 'new-environment',
      name: 'Environment',
      icon: 'code',
      action: createNewGlobalEnvironment,
    },
  ];

  const workspaceScopeOrder: Record<InsomniaFile['scope'], number> = {
    collection: 0,
    environment: 1,
    mcp: 2,
    design: 3,
    'mock-server': 4,
    unsynced: 5,
  };

  const workspaceScopeIcon: Record<InsomniaFile['scope'], IconProp> = {
    collection: 'bars',
    environment: 'code',
    mcp: ['fac', 'mcp'] as unknown as IconProp,
    design: 'file',
    'mock-server': 'server',
    unsynced: 'cloud-download',
  };

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

  const openFileFromTree = (project: (Project & { gitRepository?: GitRepository }), file: InsomniaFile, withTab?: boolean) => {
    if (file.scope === 'unsynced') {
      if (project._id === activeProject?._id && project.remoteId && file.remoteId) {
        pullFileFetcher.submit({
          backendProjectId: file.remoteId,
          remoteId: project.remoteId,
          organizationId,
        });
      }
      return;
    }

    if (!file.workspace) {
      return;
    }

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
    project: Project & { gitRepository?: GitRepository };
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

  const getProjectById = (id: string) => projectsWithPresence.find(project => project._id === id);

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
    const currentOrder = orderedProjectsWithPresence.map(project => project._id);
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

    const sourceIds = (projectFilesWithRemoteByProjectId[sourceProjectId] || []).map(file => file.id);
    const targetIds = (projectFilesWithRemoteByProjectId[targetProjectId] || []).map(file => file.id);

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
          const sourceIds = (projectFilesWithRemoteByProjectId[source.projectId] || []).map(file => file.id);
          const targetIds = (projectFilesWithRemoteByProjectId[target.projectId] || []).map(file => file.id);
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

  const createCollectionRequest = ({
    project,
    workspace,
    requestType,
    parentId,
    req,
  }: {
    project: Project & { gitRepository?: GitRepository };
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

  const getProjectActions = (project: (Project & { gitRepository?: GitRepository })): ProjectSidebarTreeAction[] => [
    {
      id: 'new-collection',
      label: 'New Collection',
      onAction: () =>
        createNewWorkspaceFetcher.submit({
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
        createNewWorkspaceFetcher.submit({
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
        createNewWorkspaceFetcher.submit({
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
        createNewWorkspaceFetcher.submit({
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
          onDone: async isYes => {
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

  const getWorkspaceActions = (
    project: (Project & { gitRepository?: GitRepository }),
    file: InsomniaFile,
  ): ProjectSidebarTreeAction[] => {
    if (file.scope === 'unsynced' || !file.workspace) {
      return [];
    }
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
            title: `Rename ${scopeToLabelMap[file.scope]}`,
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
      actions.push(
        {
          id: 'import',
          label: 'Import',
          onAction: () => {
            setWorkspaceActionTarget({ project, file, workspace: file.workspace });
            setIsWorkspaceImportModalOpen(true);
          },
        },
        {
          id: 'run-collection',
          label: 'Run Collection',
          onAction: () =>
            navigate(`/organization/${organizationId}/project/${project._id}/workspace/${file.workspace._id}/debug/runner?folder=`),
        },
        {
          id: 'duplicate-move',
          label: 'Duplicate / Move',
          onAction: () => {
            setWorkspaceActionTarget({ project, file, workspace: file.workspace });
            setIsWorkspaceDuplicateModalOpen(true);
          },
        },
      );
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

        setWorkspaceActionTarget({ project, file, workspace: file.workspace });
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
        setWorkspaceActionTarget({ project, file, workspace: file.workspace });
        setIsWorkspaceSettingsModalOpen(true);
      },
    }, {
      id: 'delete',
      label: 'Delete',
      isDanger: true,
      onAction: () =>
        showModal(AskModal, {
          title: `Delete ${scopeToLabelMap[file.scope]}`,
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

  const getCollectionActions = (
    project: (Project & { gitRepository?: GitRepository }),
    file: InsomniaFile,
  ): ProjectSidebarTreeAction[] => {
    if (!file.workspace) {
      return [];
    }
    return [
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
                workspaceId: file.workspace!._id,
                parentId: file.workspace!._id,
                name,
              }),
          }),
      },
      {
        id: 'new-http',
        label: 'HTTP Request',
        onAction: () => createCollectionRequest({ project, workspace: file.workspace!, requestType: 'HTTP' }),
      },
      {
        id: 'new-event-stream',
        label: 'Event Stream Request (SSE)',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace!, requestType: 'Event Stream' }),
      },
      {
        id: 'new-graphql',
        label: 'GraphQL Request',
        onAction: () => createCollectionRequest({ project, workspace: file.workspace!, requestType: 'GraphQL' }),
      },
      {
        id: 'new-grpc',
        label: 'gRPC Request',
        onAction: () => createCollectionRequest({ project, workspace: file.workspace!, requestType: 'gRPC' }),
      },
      {
        id: 'new-websocket',
        label: 'WebSocket Request',
        onAction: () => createCollectionRequest({ project, workspace: file.workspace!, requestType: 'WebSocket' }),
      },
      {
        id: 'new-socketio',
        label: 'Socket.IO Request',
        onAction: () => createCollectionRequest({ project, workspace: file.workspace!, requestType: 'SocketIO' }),
      },
      {
        id: 'import-curl',
        label: 'Import From Curl',
        onAction: () => {
          setCollectionActionTarget({ project, workspace: file.workspace! });
          setIsCollectionPasteCurlModalOpen(true);
        },
      },
      {
        id: 'import-file',
        label: 'Import From File',
        onAction: () => {
          setCollectionActionTarget({ project, workspace: file.workspace! });
          setIsCollectionImportModalOpen(true);
        },
      },
    ];
  };

  const getFolderActions = (
    project: (Project & { gitRepository?: GitRepository }),
    file: InsomniaFile,
    node: ProjectSidebarTreeNode,
  ): ProjectSidebarTreeAction[] => {
    if (!file.workspace) {
      return [];
    }
    const requestGroup = node.doc as RequestGroup;
    return [
      {
        id: 'open-new-tab',
        label: 'Open in New Tab',
        onAction: () => openCollectionTreeNode({ project, workspace: file.workspace!, node, withTab: true }),
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
                workspaceId: file.workspace!._id,
                parentId: requestGroup._id,
                name,
              }),
          }),
      },
      {
        id: 'new-http',
        label: 'HTTP Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace!, requestType: 'HTTP', parentId: requestGroup._id }),
      },
      {
        id: 'new-event-stream',
        label: 'Event Stream Request (SSE)',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace!,
            requestType: 'Event Stream',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'new-graphql',
        label: 'GraphQL Request',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace!,
            requestType: 'GraphQL',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'new-grpc',
        label: 'gRPC Request',
        onAction: () =>
          createCollectionRequest({ project, workspace: file.workspace!, requestType: 'gRPC', parentId: requestGroup._id }),
      },
      {
        id: 'new-websocket',
        label: 'WebSocket Request',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace!,
            requestType: 'WebSocket',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'new-socketio',
        label: 'Socket.IO Request',
        onAction: () =>
          createCollectionRequest({
            project,
            workspace: file.workspace!,
            requestType: 'SocketIO',
            parentId: requestGroup._id,
          }),
      },
      {
        id: 'import-curl',
        label: 'Import From Curl',
        onAction: () => {
          setFolderPasteCurlTarget({ project, workspace: file.workspace!, parentId: requestGroup._id });
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
                workspaceId: file.workspace!._id,
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
                workspaceId: file.workspace!._id,
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
              workspace: file.workspace!,
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
                  workspaceId: file.workspace!._id,
                  id: requestGroup._id,
                });
              }
            },
          }),
      },
    ];
  };

  const getRequestActions = (
    project: (Project & { gitRepository?: GitRepository }),
    file: InsomniaFile,
    node: ProjectSidebarTreeNode,
  ): ProjectSidebarTreeAction[] => {
    if (!file.workspace) {
      return [];
    }
    const request = node.doc as RequestLike;
    return [
      {
        id: 'open-new-tab',
        label: 'Open in New Tab',
        onAction: () => openCollectionTreeNode({ project, workspace: file.workspace!, node, withTab: true }),
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
                workspaceId: file.workspace!._id,
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
                workspaceId: file.workspace!._id,
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
                  workspaceId: file.workspace!._id,
                  id: request._id,
                });
              }
            },
          }),
      },
    ];
  };

  const isRemoteProjectInconsistent = activeProject && isRemoteProject(activeProject) && !storageRules.enableCloudSync;
  const isLocalProjectInconsistent =
    activeProject && !isRemoteProject(activeProject) && !isGitProject(activeProject) && !storageRules.enableLocalVault;
  const isGitSyncProjectInconsistent = activeProject && isGitProject(activeProject) && !storageRules.enableGitSync;
  const isProjectInconsistent =
    isRemoteProjectInconsistent || isLocalProjectInconsistent || isGitSyncProjectInconsistent;

  return (
    <ErrorBoundary>
      <Fragment>
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
                    projects={orderedProjectsWithPresence}
                    projectFilesByProjectId={projectFilesWithRemoteByProjectId}
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
                    renderProjectMeta={project =>
                      project.presence.length > 0 ? (
                        <AvatarGroup size="small" maxAvatars={3} items={project.presence} />
                      ) : null
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
                  {isRemoteProject(activeProject) &&
                    (activeWorkspace ? (
                      <SyncDropdown key={activeWorkspace._id} workspace={activeWorkspace} project={activeProject} />
                    ) : (
                      <CloudSyncProjectBar />
                    ))}
                </>
              )}
              {!isLearningFeatureDismissed && learningFeature?.active && (
                <div className="flex shrink-0 flex-col gap-2 p-(--padding-sm)">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-base">
                      <Icon icon="graduation-cap" />
                      <span className="ml-2">{learningFeature.title}</span>
                    </Heading>
                    <Button
                      onPress={() => {
                        setIsLearningFeatureDismissed('true');
                      }}
                    >
                      <Icon icon="close" />
                    </Button>
                  </div>
                  <p className="text-sm text-(--hl)">{learningFeature.message}</p>
                  <a href={learningFeature.url} className="flex items-center gap-2 text-sm underline">
                    {learningFeature.cta}
                    <Icon icon="arrow-up-right-from-square" />
                  </a>
                </div>
              )}
            </div>
          </Panel>
          <PanelResizeHandle className="h-full w-px bg-(--hl-md)" />
          <Panel id="pane-one" className="pane-one theme--pane flex flex-col">
            <OrganizationTabList showActiveStatus={false} />
            {activeProject ? (
              <div className="flex w-full flex-col overflow-hidden">
                {billing.isActive ? null : (
                  <div className="p-(--padding-md) pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
                      <p className="text-base">
                        <Icon icon="exclamation-triangle" className="mr-2" />
                        {isUserOwner
                          ? `Your ${isPersonalOrg ? 'personal account' : 'organization'} has unpaid past invoices. Please enter a new payment method to continue using Insomnia.`
                          : 'This organization has unpaid past invoices. Please ask the organization owner to enter a new payment method to continue using Insomnia.'}
                      </p>
                      {isUserOwner && (
                        <a
                          href={`${getAppWebsiteBaseURL()}/app/subscription/past-due`}
                          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-font) px-4 py-1 text-sm font-semibold text-(--color-bg) ring-1 ring-transparent transition-all hover:bg-(--hl-md)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                        >
                          Update payment method
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {billing?.expirationErrorMessage || billing?.expirationWarningMessage ? (
                  <div className="p-(--padding-md) pb-0">
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) p-(--padding-sm) text-(--color-font-warning) ${billing?.expirationWarningMessage ? 'bg-(--color-warning)/50' : 'bg-(--color-danger)/50'}`}
                    >
                      <p className="text-base">
                        <Icon icon="exclamation-triangle" className="mr-2" />
                        {billing?.expirationErrorMessage || billing?.expirationWarningMessage}
                      </p>
                      {isUserOwner && (
                        <a
                          href="https://insomnia.rest/pricing/contact"
                          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-font) px-4 py-1 text-sm font-semibold text-(--color-bg) ring-1 ring-transparent transition-all hover:bg-(--color-font)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                        >
                          Contact sales
                        </a>
                      )}
                    </div>
                  </div>
                ) : null}
                {isProjectInconsistent && (
                  <div className="p-(--padding-md) pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
                      <p className="text-base">
                        <Icon icon="exclamation-triangle" className="mr-2" />
                        The organization owner mandates that projects must be created and stored using{' '}
                        {getProjectStorageTypeLabel(storageRules)}.
                      </p>
                      <Button
                        onPress={() => {
                          if (activeProject) {
                            setProjectSettingsTarget(
                              projectsWithPresence.find(project => project._id === activeProject._id) || activeProject,
                            );
                          }
                        }}
                        className="flex items-center justify-center rounded-xs border border-solid border-white px-2 py-1"
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                )}
                {/* Show filter UI if there are files with presence or if the user has entered any filter input(even no match) */}
                {(filesWithPresence.length > 0 || workspaceListFilter) && (
                  <div className="flex w-full max-w-xl justify-between gap-2 p-(--padding-md)">
                    <SearchField
                      aria-label="Files filter"
                      className="group relative flex-1"
                      value={workspaceListFilter}
                      onChange={filter => {
                        setWorkspaceListFilter(filter);
                        if (filter.trim() !== '') {
                          trackOnceDaily(SegmentEvent.homepageFiltered);
                        }
                      }}
                    >
                      <Input
                        placeholder="Filter"
                        className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                      />
                      <div className="absolute top-0 right-0 flex h-full items-center px-2">
                        <Button className="flex aspect-square w-5 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all group-data-empty:hidden hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
                          <Icon icon="close" />
                        </Button>
                      </div>
                    </SearchField>
                    <Select
                      aria-label="Sort order"
                      className="aspect-square h-full"
                      selectedKey={workspaceListSortOrder}
                      onSelectionChange={order => setWorkspaceListSortOrder(order as DashboardSortOrder)}
                    >
                      <Button
                        aria-label="Select sort order"
                        className="flex aspect-square h-full shrink-0 items-center justify-center rounded-xs bg-(--hl-xxs) text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon icon="sort" />
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <ListBox
                          items={DASHBOARD_SORT_ORDERS.map(order => {
                            return {
                              id: order,
                              name: dashboardSortOrderName[order],
                            };
                          })}
                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                        >
                          {item => (
                            <ListBoxItem
                              id={item.id}
                              key={item.id}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.name}
                              textValue={item.name}
                              value={item}
                            >
                              {({ isSelected }) => (
                                <Fragment>
                                  <span>{item.name}</span>
                                  {isSelected && (
                                    <Icon icon="check" className="justify-self-end text-(--color-success)" />
                                  )}
                                </Fragment>
                              )}
                            </ListBoxItem>
                          )}
                        </ListBox>
                      </Popover>
                    </Select>

                    <MenuTrigger>
                      <Button
                        aria-label="Create in project"
                        className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon icon="plus-circle" /> <span className="hidden md:block">Create</span>
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <Menu
                          aria-label="Create in project actions"
                          selectionMode="single"
                          onAction={key => {
                            const item = createInProjectActionList.find(item => item.id === key);
                            if (item) {
                              item.action();
                            }
                          }}
                          items={createInProjectActionList}
                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                        >
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.name}
                            >
                              <Icon icon={item.icon} />
                              <span>{item.name}</span>
                            </MenuItem>
                          )}
                        </Menu>
                      </Popover>
                    </MenuTrigger>

                    <Button
                      onPress={() => {
                        window.main.trackSegmentEvent({
                          event: SegmentEvent.importStarted,
                          properties: {
                            source: 'project',
                          },
                        });
                        setImportModalType('file');
                      }}
                      aria-label="Import"
                      className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    >
                      <Icon icon="file-import" /> <span className="hidden md:block">Import</span>
                    </Button>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto">
                  <GridList
                    aria-label="Files"
                    data-testid="workspace-grid"
                    className="grid grid-cols-[repeat(auto-fit,200px)] grid-rows-[repeat(auto-fit,200px)] gap-4 p-(--padding-md) data-empty:flex data-empty:justify-center"
                    items={filesWithPresence}
                    renderEmptyState={() => {
                      if (workspaceListFilter) {
                        return (
                          <div className="flex h-full w-full items-center justify-center">
                            <p className="notice subtle">
                              No documents found for <strong>{workspaceListFilter}</strong>
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="flex w-full flex-col items-center justify-center gap-4">
                          <ProjectEmptyView
                            onCreateRequestCollectionWithRequest={createNewCollectionWithRequest}
                            onCreateDesignDocument={createNewDocument}
                            onImportFrom={() => setImportModalType('file')}
                          />
                          {createNewWorkspaceFetcher.data?.error && (
                            <div className="px-10">
                              <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
                                <Icon icon="triangle-exclamation" />
                                <span>{createNewWorkspaceFetcher.data?.error}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  >
                    {item => {
                      return (
                        <GridListItem
                          key={item.id}
                          id={item.id}
                          textValue={item.name}
                          // onAction is required for onPress with selectionMode='none' but we handle clicks in onPress
                          onAction={() => {}}
                          onAuxClick={e => {
                            if (e.button === 1) {
                              e.preventDefault();
                              item.action(true);
                            }
                          }}
                          onPress={e => {
                            item.action(isPrimaryClickModifier(e));
                          }}
                          className={`flex aspect-square w-full flex-1 flex-col overflow-hidden rounded-md p-(--padding-md) ring-1 ring-(--hl-md) outline-hidden transition-all select-none hover:bg-(--hl-xs) hover:shadow-md hover:ring-(--hl-sm) focus:bg-(--hl-sm) focus:ring-(--hl-lg) ${item.loading ? 'animate-pulse' : ''}`}
                        >
                          <div className="flex h-[20px] gap-2">
                            <div className="flex h-full shrink-0 items-center gap-2 rounded-xs bg-(--hl-xs) pr-2 text-sm text-(--color-font)">
                              <div
                                className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} flex h-[20px] w-[20px] items-center justify-center rounded-s-sm px-2`}
                              >
                                <Icon
                                  icon={item.loading ? 'spinner' : scopeToIconMap[item.scope]}
                                  className={item.loading ? 'animate-spin' : ''}
                                />
                              </div>
                              <span>{item.label}</span>
                            </div>
                            <span className="flex-1" />
                            {item.presence.length > 0 && (
                              <AvatarGroup size="small" maxAvatars={3} items={item.presence} />
                            )}
                            {activeProject && item.scope !== 'unsynced' && item.workspace && (
                              <WorkspaceCardDropdown
                                workspace={item.workspace}
                                mockServer={item.mockServer}
                                gitFilePath={item.gitFilePath || undefined}
                                apiSpec={item.apiSpec}
                                project={activeProject}
                                projects={projects}
                              />
                            )}
                          </div>
                          <TooltipTrigger>
                            <span className="line-clamp-4 pt-4 text-base font-bold outline-hidden">{item.name}</span>
                            <Tooltip
                              offset={8}
                              className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                            >
                              <span>{item.name}</span>
                            </Tooltip>
                          </TooltipTrigger>
                          <div className="flex flex-1 flex-col justify-end gap-2 text-sm text-(--hl)">
                            {item.gitFilePath && (
                              <div className="flex items-center gap-2 text-sm">
                                <Icon icon="file-alt" />
                                <span className="truncate" title={item.gitFilePath}>
                                  {item.gitFilePath}
                                </span>
                              </div>
                            )}
                            {item.version && <div className="flex-1 pt-2">{item.version}</div>}
                            {item.oasFormat && (
                              <div className="flex items-center gap-2 text-sm">
                                <Icon icon="file-alt" />
                                <span>{item.oasFormat}</span>
                              </div>
                            )}
                            {item.branch && (
                              <div className="flex items-center gap-2 text-sm">
                                <Icon icon="code-branch" />
                                <span className="truncate">{item.branch}</span>
                              </div>
                            )}
                            {Boolean(item.lastModifiedTimestamp) && (
                              <div className="flex items-center gap-2 truncate text-sm">
                                <Icon icon="clock" />
                                <TimeFromNow
                                  title={text =>
                                    `Last updated ${text}, and created on ${new Date(item.created).toLocaleDateString()}`
                                  }
                                  timestamp={item.lastModifiedTimestamp}
                                />
                                <span className="truncate">{item.lastCommit}</span>
                              </div>
                            )}
                            {(item.hasUncommittedChanges || item.hasUnpushedChanges) && (
                              <div className="flex items-center gap-2 text-sm text-[rgba(var(--color-warning-rgb),0.8)]">
                                <span>{item.hasUncommittedChanges ? 'Uncommitted changes' : 'Unpushed changes'}</span>
                              </div>
                            )}
                          </div>
                        </GridListItem>
                      );
                    }}
                  </GridList>
                </div>
              </div>
            ) : projects.length ? (
              <NoSelectedProjectView />
            ) : (
              <NoProjectView storageRules={storageRules} />
            )}
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
        {activeProject && newWorkspaceModalState?.isOpen && (
          <NewWorkspaceModal
            isOpen
            project={activeProject}
            storageRules={storageRules}
            currentPlan={organizationData?.currentPlan}
            scope={newWorkspaceModalState.scope}
            onOpenChange={isOpen => {
              setNewWorkspaceModalState({
                scope: newWorkspaceModalState.scope,
                isOpen,
              });
            }}
          />
        )}
        {activeProject && importModalType && (
          <ImportModal
            onHide={() => setImportModalType(null)}
            projectName={activeProject.name}
            from={{ type: importModalType }}
            organizationId={organizationId}
            defaultProjectId={activeProject._id}
          />
        )}
        {collectionActionTarget && isCollectionImportModalOpen && (
          <ImportModal
            onHide={() => setIsCollectionImportModalOpen(false)}
            from={{ type: 'file' }}
            projectName={collectionActionTarget.project.name}
            workspaceName={collectionActionTarget.workspace.name}
            organizationId={organizationId}
            defaultProjectId={collectionActionTarget.project._id}
            defaultWorkspaceId={collectionActionTarget.workspace._id}
          />
        )}
        {collectionActionTarget && isCollectionPasteCurlModalOpen && (
          <PasteCurlModal
            onImport={req => {
              createCollectionRequest({
                project: collectionActionTarget.project,
                workspace: collectionActionTarget.workspace,
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
            mockServer={workspaceActionTarget.file.mockServer}
            gitFilePath={workspaceActionTarget.file.gitFilePath || undefined}
            project={workspaceActionTarget.project}
            onClose={() => setIsWorkspaceSettingsModalOpen(false)}
          />
        )}
      </Fragment>
    </ErrorBoundary>
  );
};

export default Component;
