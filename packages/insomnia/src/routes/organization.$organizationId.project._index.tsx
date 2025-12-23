import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { getLearningFeature as getLearningFeatureAPI, type LearningFeature } from 'insomnia-api';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Button,
  GridList,
  GridListItem,
  Heading,
  Input,
  Link,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  SelectValue,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import type { LoaderFunctionArgs } from 'react-router';
import { href, redirect, useFetchers, useLoaderData, useNavigate, useParams } from 'react-router';
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
import { fuzzyMatchAll, isNotNullOrUndefined } from '~/common/misc';
import { descendingNumberSort, sortMethodMap } from '~/common/sorting';
import * as models from '~/models';
import { userSession } from '~/models';
import { type ApiSpec } from '~/models/api-spec';
import type { GitRepository } from '~/models/git-repository';
import { sortProjects } from '~/models/helpers/project';
import type { MockServer } from '~/models/mock-server';
import type { Organization } from '~/models/organization';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId } from '~/models/organization';
import {
  getProjectStorageTypeLabel,
  isGitProject,
  isLocalProject,
  isRemoteProject,
  type Project,
  SCRATCHPAD_PROJECT_ID,
} from '~/models/project';
import { isDesign, scopeToActivity, type Workspace, type WorkspaceScope } from '~/models/workspace';
import type { WorkspaceMeta } from '~/models/workspace-meta';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useInsomniaSyncPullRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.pull-remote-file';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { useStorageRulesLoaderFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { SegmentEvent } from '~/ui/analytics';
import { AvatarGroup } from '~/ui/components/avatar';
import { CloudSyncProjectBar } from '~/ui/components/dropdowns/cloud-sync-project-bar';
import { GitProjectSyncDropdown } from '~/ui/components/dropdowns/git-project-sync-dropdown';
import { LocalProjectBar } from '~/ui/components/dropdowns/local-project-bar';
import { ProjectDropdown } from '~/ui/components/dropdowns/project-dropdown';
import { WorkspaceCardDropdown } from '~/ui/components/dropdowns/workspace-card-dropdown';
import { ErrorBoundary } from '~/ui/components/error-boundary';
import { Icon } from '~/ui/components/icon';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { NewWorkspaceModal } from '~/ui/components/modals/new-workspace-modal';
import { ProjectModal } from '~/ui/components/modals/project-modal';
import { NoProjectView } from '~/ui/components/panes/no-project-view';
import { ProjectEmptyView } from '~/ui/components/project/project-empty-view';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import { TimeFromNow } from '~/ui/components/time-from-now';
import { useInsomniaEventStreamContext } from '~/ui/context/app/insomnia-event-stream-context';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { DEFAULT_STORAGE_RULES } from '~/ui/organization-utils';
import { invariant } from '~/utils/invariant';

export const scopeToLabelMap: Record<
  WorkspaceScope | 'unsynced',
  'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment' | 'MCP Client'
> = {
  'design': 'Document',
  'collection': 'Collection',
  'mock-server': 'Mock Server',
  'unsynced': 'Unsynced',
  'environment': 'Environment',
  'mcp': 'MCP Client',
};

export const scopeToIconMap: Record<string, IconName> = {
  'design': 'file',
  'collection': 'bars',
  'mock-server': 'server',
  'unsynced': 'cloud-download',
  'environment': 'code',
};

export const scopeToBgColorMap: Record<string, string> = {
  'design': 'bg-(--color-info)',
  'collection': 'bg-(--color-surprise)',
  'mock-server': 'bg-(--color-warning)',
  'unsynced': 'bg-(--hl-md)',
  'environment': 'bg-(--color-font)',
};

export const scopeToTextColorMap: Record<string, string> = {
  'design': 'text-(--color-font-info)',
  'collection': 'text-(--color-font-surprise)',
  'mock-server': 'text-(--color-font-warning)',
  'unsynced': 'text-(--color-font)',
  'environment': 'text-(--color-bg)',
};

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
  allFilesCount: number;
  documentsCount: number;
  environmentsCount: number;
  collectionsCount: number;
  mockServersCount: number;
  projectsCount: number;
  activeProject?: Project;
  activeProjectGitRepository?: GitRepository;
  projects: (Project & { gitRepository?: GitRepository })[];
  learningFeaturePromise?: Promise<LearningFeature>;
  remoteFilesPromise?: Promise<InsomniaFile[]>;
  projectsSyncStatusPromise?: Promise<Record<string, boolean>>;
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
    invariant(project, 'Project not found');

    const remoteId = project.remoteId;
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

const getLearningFeature = async (fallbackLearningFeature: LearningFeature) => {
  let learningFeature = fallbackLearningFeature;
  const lastFetchedString = window.localStorage.getItem('learning-feature-last-fetch');
  const lastFetched = lastFetchedString ? Number.parseInt(lastFetchedString, 10) : 0;
  const oneDay = 86_400_000;
  const hasOneDayPassedSinceLastFetch = Date.now() - lastFetched > oneDay;
  const wasDismissed = window.localStorage.getItem('learning-feature-dismissed');
  const wasNotDismissedAndOneDayHasPassed = !wasDismissed && hasOneDayPassedSinceLastFetch;
  if (wasNotDismissedAndOneDayHasPassed) {
    try {
      learningFeature = await getLearningFeatureAPI();
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

async function getProjectsWithGitRepositories({
  organizationId,
}: {
  organizationId: string;
}): Promise<(Project & { gitRepository?: GitRepository })[]> {
  const projects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  });

  const gitRepositoryIds = projects.map(p => p.gitRepositoryId).filter(isNotNullOrUndefined);

  const gitRepositories = await database.find<GitRepository>(models.gitRepository.type, {
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
      allFilesCount: 0,
      documentsCount: 0,
      environmentsCount: 0,
      collectionsCount: 0,
      mockServersCount: 0,
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
  invariant(project, `Project was not found ${projectId}`);
  console.log('[project loader] Loading project:', project.name, projectId);
  const [localFiles, organizationProjects = []] = await Promise.all([
    getAllLocalFiles({ projectId }),
    getProjectsWithGitRepositories({ organizationId }),
  ]);

  const remoteFilesPromise = getAllRemoteFiles({ projectId, organizationId });
  const learningFeaturePromise = getLearningFeature(fallbackLearningFeature);

  const projects = sortProjects(organizationProjects);

  const projectsSyncStatusPromise = CheckAllProjectSyncStatus(projects);

  const activeProjectGitRepository = isGitProject(project)
    ? await models.gitRepository.getById(project.gitRepositoryId || '')
    : null;

  return {
    localFiles,
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
    projectsSyncStatusPromise,
  };
}

const Component = () => {
  const {
    localFiles,
    activeProject,
    activeProjectGitRepository,
    projects,
    allFilesCount,
    environmentsCount,
    collectionsCount,
    mockServersCount,
    documentsCount,
    projectsCount,
    learningFeaturePromise,
    remoteFilesPromise,
    projectsSyncStatusPromise,
  } = useLoaderData() as ProjectLoaderData;
  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = reactUse.useLocalStorage(
    'learning-feature-dismissed',
    '',
  );
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
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
      fetcher =>
        fetcher.formAction === href(`/organization/:organizationId/insomnia-sync/pull-remote-file`, { organizationId }),
    )
    .map(f => f.formData?.get('backendProjectId'));

  const organizationData = useOrganizationLoaderData();
  const { presence } = useInsomniaEventStreamContext();
  const storageRuleFetcher = useStorageRulesLoaderFetcher({ key: `storage-rule:${organizationId}` });
  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const { billing, features } = useOrganizationPermissions();

  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load({ organizationId });
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { storagePromise } = storageRuleFetcher.data || {};

  const [storageRules = DEFAULT_STORAGE_RULES] = useLoaderDeferData(storagePromise, organizationId);

  const [projectListFilter, setProjectListFilter] = reactUse.useLocalStorage(
    `${organizationId}:project-list-filter`,
    '',
  );
  const [workspaceListFilter, setWorkspaceListFilter] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-filter`,
    '',
  );
  const [workspaceListScope, setWorkspaceListScope] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-scope`,
    'all',
  );
  const [workspaceListSortOrder, setWorkspaceListSortOrder] = reactUse.useLocalStorage(
    `${projectId}:workspace-list-sort-order`,
    'modified-desc',
  );
  const [importModalType, setImportModalType] = useState<'file' | 'clipboard' | 'uri' | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isUpdateProjectModalOpen, setIsUpdateProjectModalOpen] = useState(false);
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  const isUserOwner =
    organization && userSession.accountId && isOwnerOfOrganization({ organization, accountId: userSession.accountId });
  const isPersonalOrg = organization && isPersonalOrganization(organization);

  const filteredFiles = allFiles
    .filter(w => (workspaceListScope !== 'all' ? w.scope === workspaceListScope : true))
    .filter(workspace =>
      workspaceListFilter
        ? Boolean(
            fuzzyMatchAll(
              workspaceListFilter,
              // Use the filter string to match against these properties
              [
                workspace.name,
                workspace.scope === 'design' ? 'document' : 'collection',
                workspace.branch || '',
                workspace.oasFormat || '',
              ],
              { splitSpace: true, loose: true },
            )?.indexes,
          )
        : true,
    )
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
      action: () => {
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

        const activity = scopeToActivity(file.scope);
        return navigate(`/organization/${organizationId}/project/${projectId}/workspace/${file.id}/${activity}`);
      },
    }));

  const projectsWithPresence = projects
    .filter(p => (projectListFilter ? p.name?.toLowerCase().includes(projectListFilter.toLowerCase()) : true))
    .map(project => {
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
  const isGitSyncEnabled = features.gitSync.enabled;

  const createInProjectActionList: {
    id: string;
    name: string;
    icon: IconName;
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

  const scopeActionList: {
    id: string;
    label: string;
    icon: IconName;
    action?: {
      icon: IconName;
      label: string;
      run: () => void;
    };
  }[] = [
    {
      id: 'all',
      label: `All files (${allFilesCount})`,
      icon: 'border-all',
    },
    {
      id: 'design',
      label: `Documents (${documentsCount})`,
      icon: 'file',
      action: {
        icon: 'plus',
        label: 'New design document',
        run: createNewDocument,
      },
    },
    {
      id: 'collection',
      label: `Collections (${collectionsCount})`,
      icon: 'bars',
      action: {
        icon: 'plus',
        label: 'New request collection',
        run: createNewCollection,
      },
    },
    ...(canCreateMockServer
      ? [
          {
            id: 'mock-server',
            label: `Mock (${mockServersCount})`,
            icon: 'server' as IconName,
            action: {
              icon: 'plus' as IconName,
              label: 'New Mock Server',
              run: createNewMockServer,
            },
          },
        ]
      : []),
    {
      id: 'environment',
      label: `Environments (${environmentsCount})`,
      icon: 'code',
      action: {
        icon: 'plus',
        label: 'New Environment',
        run: createNewGlobalEnvironment,
      },
    },
  ];

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
              <div className="h-[40px] p-(--padding-sm)">
                <Select
                  aria-label="Organizations"
                  onSelectionChange={id => {
                    navigate(`/organization/${id}`);
                  }}
                  selectedKey={organizationId}
                >
                  <Button className="flex flex-1 items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)">
                    <SelectValue<Organization> className="flex items-center justify-center gap-2 truncate">
                      {({ selectedItem }) => {
                        return selectedItem?.display_name || 'Select an organization';
                      }}
                    </SelectValue>
                    <Icon icon="caret-down" />
                  </Button>
                  <Popover className="flex min-w-max flex-col overflow-y-hidden">
                    <ListBox
                      items={organizationData?.organizations}
                      className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                    >
                      {item => (
                        <ListBoxItem
                          id={item.id}
                          key={item.id}
                          className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                          aria-label={item.display_name}
                          textValue={item.display_name}
                          value={item}
                        >
                          {({ isSelected }) => (
                            <Fragment>
                              <span>{item.display_name}</span>
                              {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                            </Fragment>
                          )}
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Popover>
                </Select>
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                <Heading className="p-(--padding-sm) text-xs uppercase">Projects ({projectsCount})</Heading>
                <div className="flex justify-between gap-1 p-(--padding-sm)">
                  <SearchField
                    aria-label="Projects filter"
                    className="group relative flex-1"
                    isDisabled={activeProject === undefined}
                    value={projectListFilter}
                    onChange={value => {
                      setProjectListFilter(value);

                      if (value.trim() !== '') {
                        window.main.trackSegmentEvent({
                          event: SegmentEvent.filterCreatedHomePage,
                        });
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
                  <Button
                    aria-label="Create new Project"
                    onPress={() => setIsNewProjectModalOpen(true)}
                    isDisabled={activeProject === undefined}
                    className="flex aspect-square h-full items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  >
                    <Icon icon="plus-circle" />
                  </Button>
                </div>

                <GridList
                  aria-label="Projects"
                  items={projectsWithPresence}
                  className="flex-1 overflow-y-auto py-(--padding-sm) data-empty:py-0"
                  disallowEmptySelection
                  selectedKeys={[activeProject?._id || '']}
                  selectionMode="single"
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      const [value] = keys.values();

                      navigate({
                        pathname: `/organization/${organizationId}/project/${value}`,
                      });
                    }
                  }}
                >
                  {item => {
                    return (
                      <GridListItem
                        key={item._id}
                        id={item._id}
                        textValue={item.name}
                        className="group outline-hidden select-none"
                      >
                        <div className="relative flex h-(--line-height-xs) w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                          <span className="absolute top-0 left-0 h-full w-[2px] bg-transparent transition-colors group-aria-selected:bg-(--color-surprise)" />
                          <Icon
                            icon={
                              isRemoteProject(item)
                                ? 'globe-americas'
                                : isGitProject(item)
                                  ? ['fab', 'git-alt']
                                  : 'laptop'
                            }
                          />
                          <span className={'truncate'}>{item.name}</span>
                          <span className="flex-1" />
                          {item.presence.length > 0 && (
                            <AvatarGroup size="small" maxAvatars={3} items={item.presence} />
                          )}
                          {item._id !== SCRATCHPAD_PROJECT_ID && (
                            <ProjectDropdown
                              organizationId={organizationId}
                              project={item}
                              storageRules={storageRules}
                              isGitSyncEnabled={isGitSyncEnabled}
                            />
                          )}
                        </div>
                      </GridListItem>
                    );
                  }}
                </GridList>
              </div>
              {activeProject && (
                <>
                  <GridList
                    aria-label="Scope filter"
                    items={scopeActionList}
                    className="flex-1 shrink-0 overflow-y-auto py-(--padding-sm) data-empty:py-0"
                    disallowEmptySelection
                    selectedKeys={[workspaceListScope || 'all']}
                    selectionMode="single"
                    onSelectionChange={keys => {
                      if (keys !== 'all') {
                        const [value] = keys.values();

                        setWorkspaceListScope(value.toString());
                      }
                    }}
                  >
                    {item => {
                      return (
                        <GridListItem textValue={item.label} className="group outline-hidden select-none">
                          <div className="relative flex h-12 w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                            <span className="flex h-6 w-6 items-center justify-center">
                              <Icon icon={item.icon} className="w-6" />
                            </span>

                            <span className="truncate capitalize">{item.label}</span>
                            <span className="flex-1" />
                            {item.action && (
                              <Button
                                onPress={item.action.run}
                                aria-label={item.action.label}
                                className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-80 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                              >
                                <Icon icon={item.action.icon} />
                              </Button>
                            )}
                          </div>
                        </GridListItem>
                      );
                    }}
                  </GridList>
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
                          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-font) px-4 py-1 text-sm font-semibold text-(--color-bg) ring-1 ring-transparent transition-all hover:bg-(--color-font-bg)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
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
                        onPress={() => setIsUpdateProjectModalOpen(true)}
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
                      onChange={filter => setWorkspaceListFilter(filter)}
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
                              <div className="flex items-center gap-2 rounded-xs bg-(--color-danger)/50 px-2 py-1 text-sm text-(--color-font-danger)">
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
                          onAction={item.action}
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
                            <Link
                              onPress={item.action}
                              className="line-clamp-4 pt-4 text-base font-bold outline-hidden"
                            >
                              {item.name}
                            </Link>
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
                              <div className="flex items-center gap-2 text-sm text-(--color-warning)/80">
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
            ) : (
              <NoProjectView isGitSyncEnabled={isGitSyncEnabled} storageRules={storageRules} />
            )}
          </Panel>
        </PanelGroup>
        {isNewProjectModalOpen && (
          <ProjectModal
            isOpen={isNewProjectModalOpen}
            onOpenChange={setIsNewProjectModalOpen}
            storageRules={storageRules}
            isGitSyncEnabled={isGitSyncEnabled}
          />
        )}
        {isUpdateProjectModalOpen && (
          <ProjectModal
            isOpen={isUpdateProjectModalOpen}
            onOpenChange={setIsUpdateProjectModalOpen}
            project={activeProject}
            gitRepository={activeProjectGitRepository || undefined}
            storageRules={storageRules}
            isGitSyncEnabled={isGitSyncEnabled}
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
      </Fragment>
    </ErrorBoundary>
  );
};

export default Component;
