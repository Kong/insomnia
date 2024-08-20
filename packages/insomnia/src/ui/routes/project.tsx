import type { IconName } from '@fortawesome/fontawesome-svg-core';
import * as Sentry from '@sentry/electron/renderer';
import React, { type FC, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Input,
  Label,
  Link,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Radio,
  RadioGroup,
  SearchField,
  Select,
  SelectValue,
  TextField,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import {
  type ActionFunction,
  defer,
  type LoaderFunction,
  redirect,
  useFetcher,
  useFetchers,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import { logout } from '../../account/session';
import { parseApiSpec, type ParsedApiSpec } from '../../common/api-specs';
import {
  DASHBOARD_SORT_ORDERS,
  type DashboardSortOrder,
  dashboardSortOrderName,
  DEFAULT_SIDEBAR_SIZE,
  getAppWebsiteBaseURL,
} from '../../common/constants';
import { database } from '../../common/database';
import { fuzzyMatchAll, isNotNullOrUndefined } from '../../common/misc';
import { LandingPage, SentryMetrics } from '../../common/sentry';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import * as models from '../../models';
import { userSession } from '../../models';
import type { ApiSpec } from '../../models/api-spec';
import { sortProjects } from '../../models/helpers/project';
import type { MockServer } from '../../models/mock-server';
import type { Organization } from '../../models/organization';
import { isOwnerOfOrganization, isPersonalOrganization, isScratchpadOrganizationId } from '../../models/organization';
import {
  isRemoteProject,
  type Project,
  SCRATCHPAD_PROJECT_ID,
} from '../../models/project';
import { isDesign, scopeToActivity, type Workspace, type WorkspaceScope } from '../../models/workspace';
import type { WorkspaceMeta } from '../../models/workspace-meta';
import { VCSInstance } from '../../sync/vcs/insomnia-sync';
import { showModal } from '../../ui/components/modals';
import { AskModal } from '../../ui/components/modals/ask-modal';
import { insomniaFetch } from '../../ui/insomniaFetch';
import { invariant } from '../../utils/invariant';
import { getInitialRouteForOrganization } from '../../utils/router';
import { AvatarGroup } from '../components/avatar';
import { ProjectDropdown } from '../components/dropdowns/project-dropdown';
import { WorkspaceCardDropdown } from '../components/dropdowns/workspace-card-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { showAlert, showPrompt } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { GitRepositoryCloneModal } from '../components/modals/git-repository-settings-modal/git-repo-clone-modal';
import { ImportModal } from '../components/modals/import-modal';
import { MockServerSettingsModal } from '../components/modals/mock-server-settings-modal';
import { EmptyStatePane } from '../components/panes/project-empty-state-pane';
import { TimeFromNow } from '../components/time-from-now';
import { useInsomniaEventStreamContext } from '../context/app/insomnia-event-stream-context';
import { useLoaderDeferData } from '../hooks/use-loader-defer-data';
import { DefaultStorage, type OrganizationFeatureLoaderData, type OrganizationLoaderData, type OrganizationStorageLoaderData, useOrganizationLoaderData } from './organization';
import { useRootLoaderData } from './root';

interface TeamProject {
  id: string;
  name: string;
}

async function getAllTeamProjects(organizationId: string) {
  const { id: sessionId } = await userSession.getOrCreate();
  if (!sessionId) {
    return [];
  }

  console.log('[project] Fetching', organizationId);
  const response = await insomniaFetch<{
    data: {
      id: string;
      name: string;
    }[];
  }>({
    path: `/v1/organizations/${organizationId}/team-projects`,
    method: 'GET',
    sessionId,
  });

  return response.data as TeamProject[];
}

export const scopeToLabelMap: Record<WorkspaceScope | 'unsynced', 'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment'> = {
  design: 'Document',
  collection: 'Collection',
  'mock-server': 'Mock Server',
  unsynced: 'Unsynced',
  environment: 'Environment',
};

export const scopeToIconMap: Record<string, IconName> = {
  design: 'file',
  collection: 'bars',
  'mock-server': 'server',
  unsynced: 'cloud-download',
  environment: 'code',
};

export const scopeToBgColorMap: Record<string, string> = {
  design: 'bg-[--color-info]',
  collection: 'bg-[--color-surprise]',
  'mock-server': 'bg-[--color-warning]',
  unsynced: 'bg-[--hl-md]',
  environment: 'bg-[--color-font]',
};

export const scopeToTextColorMap: Record<string, string> = {
  design: 'text-[--color-font-info]',
  collection: 'text-[--color-font-surprise]',
  'mock-server': 'text-[--color-font-warning]',
  unsynced: 'text-[--color-font]',
  environment: 'text-[--color-bg]',
};

async function syncTeamProjects({
  organizationId,
  teamProjects,
}: {
  teamProjects: TeamProject[];
  organizationId: string;
  }) {
  // assumption: api teamProjects is the source of truth for migrated projects
  // once migrated orgs become the source of truth for projects
  // its important that migration be completed before this code is run
  const existingRemoteProjects = await database.find<Project>(models.project.type, {
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  const existingRemoteProjectsRemoteIds = existingRemoteProjects.map(p => p.remoteId);
  const remoteProjectsThatNeedToBeCreated = teamProjects.filter(p => !existingRemoteProjectsRemoteIds.includes(p.id));

  // this will create a new project for any remote projects that don't exist in the current organization
  await Promise.all(remoteProjectsThatNeedToBeCreated.map(async prj => {
    await models.project.create(
      {
        remoteId: prj.id,
        name: prj.name,
        parentId: organizationId,
      }
    );
  }));

  const remoteProjectsThatNeedToBeUpdated = await database.find<Project>(models.project.type, {
    // Name is not in the list of remote projects
    name: { $nin: teamProjects.map(p => p.name) },
    // Remote ID is in the list of remote projects
    remoteId: { $in: teamProjects.map(p => p.id) },
  });

  await Promise.all(remoteProjectsThatNeedToBeUpdated.map(async prj => {
    const remoteProject = teamProjects.find(p => p.id === prj.remoteId);
    if (remoteProject) {
      await models.project.update(prj, {
        name: remoteProject.name,
      });
    }
  }));

  // Turn remote projects from the current organization that are not in the list of remote projects into local projects.
  const removedRemoteProjects = await database.find<Project>(models.project.type, {
    // filter by this organization so no legacy data can be accidentally removed, because legacy had null parentId
    parentId: organizationId,
    // Remote ID is not in the list of remote projects.
    // add `$ne: null` condition because if remoteId is already null, we dont need to remove it again.
    // nedb use append-only format, all updates and deletes actually result in lines added
    remoteId: {
      $nin: teamProjects.map(p => p.id),
      $ne: null,
    },
  });

  await Promise.all(removedRemoteProjects.map(async prj => {
    await models.project.update(prj, {
      remoteId: null,
    });
  }));
}

export const syncProjects = async (organizationId: string) => {
  const user = await models.userSession.getOrCreate();
  const teamProjects = await getAllTeamProjects(organizationId);
  // ensure we don't sync projects in the wrong place
  if (teamProjects.length > 0 && user.id && !isScratchpadOrganizationId(organizationId)) {
    await syncTeamProjects({
      organizationId,
      teamProjects,
    });
  }
};

export const syncProjectsAction: ActionFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  await syncProjects(organizationId);

  return null;
};

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  try {
    await syncProjects(organizationId);
  } catch (err) {
    console.log('[project] Could not fetch remote projects.');
  }
  const initialOrganizationRoute = await getInitialRouteForOrganization({ organizationId });
  return redirect(initialOrganizationRoute);
};

export interface InsomniaFile {
  id: string;
  name: string;
  remoteId?: string;
  scope: WorkspaceScope | 'unsynced';
  label: 'Document' | 'Collection' | 'Mock Server' | 'Unsynced' | 'Environment';
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
}

export interface ProjectIdLoaderData {
  activeProject?: Project;
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
  projects: Project[];
  learningFeaturePromise?: Promise<LearningFeature>;
  remoteFilesPromise?: Promise<InsomniaFile[]>;
  projectsSyncStatusPromise?: Promise<Record<string, boolean>>;
}

async function getAllLocalFiles({
  projectId,
}: {
  projectId: string;
}) {
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
      } catch (err) {
        // Assume there is no spec
        // TODO: Check for parse errors if it's an invalid spec
      }
    }
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);

    const lastActiveBranch = workspaceMeta?.cachedGitRepositoryBranch;

    const lastCommitAuthor = workspaceMeta?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = isDesign(workspace)
      ? apiSpec?.modified || 0
      : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      modifiedLocally,
      workspaceMeta?.cachedGitLastCommitTime,
    ];

    const lastModifiedTimestamp = lastModifiedFrom
      .filter(isNotNullOrUndefined)
      .sort(descendingNumberSort)[0];

    const hasUnsavedChanges = Boolean(
      isDesign(workspace) &&
        workspaceMeta?.cachedGitLastCommitTime &&
        modifiedLocally > workspaceMeta?.cachedGitLastCommitTime
    );

    const specVersion = spec?.info?.version ? String(spec?.info?.version) : '';

    return {
      id: workspace._id,
      name: workspace.name,
      scope: workspace.scope,
      label: scopeToLabelMap[workspace.scope],
      created: workspace.created,
      lastModifiedTimestamp: (hasUnsavedChanges && modifiedLocally) || workspaceMeta?.cachedGitLastCommitTime || lastModifiedTimestamp,
      branch: lastActiveBranch || '',
      lastCommit: hasUnsavedChanges && workspaceMeta?.cachedGitLastCommitTime && lastCommitAuthor ? `by ${lastCommitAuthor}` : '',
      version: specVersion ? `${specVersion?.startsWith('v') ? '' : 'v'}${specVersion}` : '',
      oasFormat: specFormat ? `${specFormat === 'openapi' ? 'OpenAPI' : 'Swagger'} ${specFormatVersion || ''}` : '',
      mockServer,
      apiSpec,
      workspace,
      hasUncommittedChanges: workspaceMeta?.hasUncommittedChanges,
      hasUnpushedChanges: workspaceMeta?.hasUnpushedChanges,
    };
  });
  return files;
}

async function getAllRemoteFiles({
  projectId,
  organizationId,
}: {
  projectId: string;
  organizationId: string;
}) {
  try {
    const project = await models.project.getById(projectId);
    invariant(project, 'Project not found');

    const remoteId = project.remoteId;
    invariant(remoteId, 'Project is not a remote project');
    const vcs = VCSInstance();

    const [allPulledBackendProjectsForRemoteId, allFetchedRemoteBackendProjectsForRemoteId] = await Promise.all([
      vcs.localBackendProjects().then(projects => projects.filter(p => p.id === remoteId)),
    // Remote backend projects are fetched from the backend since they are not stored locally
      vcs.remoteBackendProjects({ teamId: organizationId, teamProjectId: remoteId }),
    ]);

    // Get all workspaces that are connected to backend projects and under the current project
    const workspacesWithBackendProjects = await database.find<Workspace>(models.workspace.type, {
      _id: {
        $in: [...allPulledBackendProjectsForRemoteId, ...allFetchedRemoteBackendProjectsForRemoteId].map(p => p.rootDocumentId),
      },
      parentId: project._id,
    });

    // Get the list of remote backend projects that we need to pull
    const backendProjectsToPull = allFetchedRemoteBackendProjectsForRemoteId
      .filter(p => !workspacesWithBackendProjects.find(w => w._id === p.rootDocumentId));

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

export interface ListWorkspacesLoaderData {
  files: InsomniaFile[];
  activeProject?: Project;
  projects: Project[];
}

export const listWorkspacesLoader: LoaderFunction = async ({ params }): Promise<ListWorkspacesLoaderData> => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, `Project was not found ${projectId}`);
  const organizationProjects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  }) || [];

  const projects = sortProjects(organizationProjects);
  const files = await getAllLocalFiles({ projectId });

  return {
    files,
    activeProject: project,
    projects,
  };
};

export const projectIdLoader: LoaderFunction = async ({ params }): Promise<ProjectIdLoaderData> => {
  const { projectId } = params;
  invariant(projectId, 'Project ID is required');

  const project = await models.project.getById(projectId);
  invariant(project, `Project was not found ${projectId}`);

  return {
    activeProject: project,
  };
};

interface LearningFeature {
  active: boolean;
  title: string;
  message: string;
  cta: string;
  url: string;
}
const getLearningFeature = async (fallbackLearningFeature: LearningFeature) => {
  let learningFeature = fallbackLearningFeature;
  const lastFetchedString = window.localStorage.getItem('learning-feature-last-fetch');
  const lastFetched = lastFetchedString ? parseInt(lastFetchedString, 10) : 0;
  const oneDay = 86400000;
  const hasOneDayPassedSinceLastFetch = (Date.now() - lastFetched) > oneDay;
  const wasDismissed = window.localStorage.getItem('learning-feature-dismissed');
  const wasNotDismissedAndOneDayHasPassed = !wasDismissed && hasOneDayPassedSinceLastFetch;
  if (wasNotDismissedAndOneDayHasPassed) {
    try {
      learningFeature = await insomniaFetch<LearningFeature>({
        method: 'GET',
        path: '/insomnia-production-public-assets/inapp-learning.json',
        origin: 'https://storage.googleapis.com',
        sessionId: '',
      });
      window.localStorage.setItem('learning-feature-last-fetch', Date.now().toString());
    } catch (err) {
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

export const loader: LoaderFunction = async ({
  params,
}) => {
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
    throw redirect('/auth/login');
  }

  invariant(projectId, 'projectId parameter is required');

  const project = await models.project.getById(projectId);
  invariant(project, `Project was not found ${projectId}`);

  const [localFiles, organizationProjects = []] = await Promise.all([
    getAllLocalFiles({ projectId }),
    database.find<Project>(models.project.type, {
      parentId: organizationId,
    }),
  ]);

  const remoteFilesPromise = getAllRemoteFiles({ projectId, organizationId });
  const learningFeaturePromise = getLearningFeature(fallbackLearningFeature);

  const projects = sortProjects(organizationProjects);

  const projectsSyncStatusPromise = CheckAllProjectSyncStatus(projects);

  return defer({
    localFiles,
    learningFeaturePromise,
    remoteFilesPromise,
    projects,
    projectsCount: organizationProjects.length,
    activeProject: project,
    allFilesCount: localFiles.length,
    environmentsCount: localFiles.filter(
      file => file.scope === 'environment'
    ).length,
    documentsCount: localFiles.filter(
      file => file.scope === 'design'
    ).length,
    collectionsCount: localFiles.filter(
      file => file.scope === 'collection'
    ).length,
    mockServersCount: localFiles.filter(
      file => file.scope === 'mock-server'
    ).length,
    projectsSyncStatusPromise,
  });
};

const ProjectRoute: FC = () => {
  const {
    localFiles,
    activeProject,
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
  const [isLearningFeatureDismissed, setIsLearningFeatureDismissed] = useLocalStorage('learning-feature-dismissed', '');
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };
  const [learningFeature] = useLoaderDeferData<LearningFeature>(learningFeaturePromise);
  const [remoteFiles] = useLoaderDeferData<InsomniaFile[]>(remoteFilesPromise, projectId);
  const [checkAllProjectSyncStatus] = useLoaderDeferData<Record<string, boolean>>(projectsSyncStatusPromise);

  const allFiles = useMemo(() => {
    return remoteFiles ? [...localFiles, ...remoteFiles] : localFiles;
  }, [localFiles, remoteFiles]);

  const { userSession } = useRootLoaderData();
  const pullFileFetcher = useFetcher();
  const updateProjectFetcher = useFetcher();
  const loadingBackendProjects = useFetchers().filter(fetcher => fetcher.formAction === `/organization/${organizationId}/project/${projectId}/remote-collections/pull`).map(f => f.formData?.get('backendProjectId'));

  const { organizations } = useOrganizationLoaderData();
  const { presence } = useInsomniaEventStreamContext();
  const permissionsFetcher = useFetcher<OrganizationFeatureLoaderData>({ key: `permissions:${organizationId}` });
  const storageRuleFetcher = useFetcher<OrganizationStorageLoaderData>({ key: `storage-rule:${organizationId}` });

  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      const load = permissionsFetcher.load;
      load(`/organization/${organizationId}/permissions`);
    }
  }, [organizationId, permissionsFetcher.load]);

  useEffect(() => {
    if (!isScratchpadOrganizationId(organizationId)) {
      const load = storageRuleFetcher.load;
      load(`/organization/${organizationId}/storage-rule`);
    }
  }, [organizationId, storageRuleFetcher.load]);

  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;

  const { featuresPromise, billingPromise } = permissionsFetcher.data || {};
  const [features = {
    gitSync: { enabled: false, reason: 'Insomnia API unreachable' },
    orgBasicRbac: { enabled: false, reason: 'Insomnia API unreachable' },
  }] = useLoaderDeferData(featuresPromise);
  const [billing = {
    isActive: true,
  }] = useLoaderDeferData(billingPromise);

  const { storagePromise } = storageRuleFetcher.data || {};

  const [storage = DefaultStorage] = useLoaderDeferData(storagePromise);

  const [projectListFilter, setProjectListFilter] = useLocalStorage(`${organizationId}:project-list-filter`, '');
  const [workspaceListFilter, setWorkspaceListFilter] = useLocalStorage(`${projectId}:workspace-list-filter`, '');
  const [workspaceListScope, setWorkspaceListScope] = useLocalStorage(`${projectId}:workspace-list-scope`, 'all');
  const [workspaceListSortOrder, setWorkspaceListSortOrder] = useLocalStorage(`${projectId}:workspace-list-sort-order`, 'modified-desc');
  const [importModalType, setImportModalType] = useState<'file' | 'clipboard' | 'uri' | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isUpdateProjectModalOpen, setIsUpdateProjectModalOpen] = useState(false);
  const [projectType, setProjectType] = useState<'local' | 'remote' | ''>('');
  const organization = organizations.find(o => o.id === organizationId);
  const isUserOwner = organization && userSession.accountId && isOwnerOfOrganization({ organization, accountId: userSession.accountId });
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
              workspace.scope === 'design'
                ? 'document'
                : 'collection',
              workspace.branch || '',
              workspace.oasFormat || '',
            ],
            { splitSpace: true, loose: true }
          )?.indexes
        )
        : true
    )
    .sort((a, b) => sortMethodMap[workspaceListSortOrder as DashboardSortOrder](a, b));

  const filesWithPresence = filteredFiles.map(file => {
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
      loading: loadingBackendProjects.includes(file.remoteId) || pullFileFetcher.formData?.get('backendProjectId') && pullFileFetcher.formData?.get('backendProjectId') === file.remoteId,
      presence: workspacePresence,
    };
  }).map(file => ({
    ...file,
    action: () => {
      // hack to workaround gridlist not have access to workspace scope
      if (file.scope === 'unsynced') {
        if (activeProject?.remoteId && file.remoteId) {
          return pullFileFetcher.submit({ backendProjectId: file.remoteId, remoteId: activeProject.remoteId }, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
          });
        }

        return;
      }

      const activity = scopeToActivity(file.scope);
      navigate(
        `/organization/${organizationId}/project/${projectId}/workspace/${file.id}/${activity}`
      );
    },
  }));

  const projectsWithPresence = projects.filter(p =>
    projectListFilter ? p.name?.toLowerCase().includes(projectListFilter.toLowerCase()) : true
  ).map(project => {
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
      hasUncommittedOrUnpushedChanges: checkAllProjectSyncStatus?.[project._id],
    };
  });

  const [isGitRepositoryCloneModalOpen, setIsGitRepositoryCloneModalOpen] =
    useState(false);
  const [isMockServerSettingsModalOpen, setIsMockServerSettingsModalOpen] = useState(false);

  const fetcher = useFetcher();
  const navigate = useNavigate();

  const createNewCollection = () => {
    activeProject?._id &&
    showPrompt({
      title: 'Create New Request Collection',
      submitName: 'Create',
      placeholder: 'My Collection',
      defaultValue: 'My Collection',
      selectText: true,
      onComplete: async (name: string) => {
        fetcher.submit(
          {
            name,
            scope: 'collection',
          },
          {
            action: `/organization/${organizationId}/project/${activeProject._id}/workspace/new`,
            method: 'post',
          }
        );
      },
    });
  };

  const createNewDocument = () => {
    activeProject?._id &&
    showPrompt({
      title: 'Create New Design Document',
      submitName: 'Create',
      placeholder: 'my-spec.yaml',
      defaultValue: 'my-spec.yaml',
      selectText: true,
      onComplete: async (name: string) => {
        fetcher.submit(
          {
            name,
            scope: 'design',
          },
          {
            action: `/organization/${organizationId}/project/${activeProject._id}/workspace/new`,
            method: 'post',
          }
        );
      },
    });
  };
  const isEnterprise = currentPlan?.type.includes('enterprise');
  const isCloudProjectOrEnterprisePlan = activeProject?.remoteId || isEnterprise;
  const canCreateMockServer = activeProject?._id && isCloudProjectOrEnterprisePlan;
  const createNewMockServer = () => {
    canCreateMockServer
      ? setIsMockServerSettingsModalOpen(true)
      : showModal(AlertModal, {
        title: 'Change Project',
        message: 'Mock feature is only supported for Cloud projects and Enterprise local projects.',
    });
  };

  const createNewGlobalEnvironment = () => {
    activeProject?._id &&
      showPrompt({
        title: 'Create New Environment',
        submitName: 'Create',
        placeholder: 'New environment',
        defaultValue: 'New environment',
        selectText: true,
        onComplete: async (name: string) => {
          fetcher.submit(
            {
              name,
              scope: 'environment',
            },
            {
              action: `/organization/${organizationId}/project/${activeProject._id}/workspace/new`,
              method: 'post',
            }
          );
        },
      });
  };

  const createNewProjectFetcher = useFetcher({
    key: `${organizationId}-${projectId}-create-new-project`,
  });

  useEffect(() => {
    if (createNewProjectFetcher.data && createNewProjectFetcher.data.error && createNewProjectFetcher.state === 'idle') {
      if (createNewProjectFetcher.data.error === 'NEEDS_TO_UPGRADE') {
        showModal(AskModal, {
          title: 'Upgrade your plan',
          message: 'You are currently on the Free plan where you can invite as many collaborators as you want as long as you don\'t have more than one project. Since you have more than one project, you need to upgrade to "Individual" or above to continue.',
          yesText: 'Upgrade',
          noText: 'Cancel',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=individual`);
            }
          },
        });
      } else if (createNewProjectFetcher.data.error === 'FORBIDDEN') {
        showAlert({
          title: 'Could not create project.',
          message: 'You do not have permission to create a project in this organization.',
        });
      } else {
        showAlert({
          title: 'Could not create project.',
          message: createNewProjectFetcher.data.error,
        });
      }
    }
  }, [createNewProjectFetcher.state, createNewProjectFetcher.data]);

  const isGitSyncEnabled = features.gitSync.enabled;

  const showUpgradePlanModal = () => {
    if (!organization || !userSession.accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization,
      accountId: userSession.accountId,
    });

    isOwner ?
      showModal(AskModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please upgrade your plan.',
        yesText: 'Upgrade',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
          }
        },
      }) : showModal(AlertModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please ask the organization owner to upgrade.',
      });
  };

  const importFromGit = () => {
    isGitSyncEnabled ?
      setIsGitRepositoryCloneModalOpen(true)
      : showUpgradePlanModal();
  };

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
    {
      id: 'new-mock-server',
      name: 'Mock Server',
      icon: 'server',
      action: createNewMockServer,
      },
      {
        id: 'new-environment',
        name: 'Environment',
        icon: 'code',
        action: createNewGlobalEnvironment,
      },
      {
      id: 'git-clone',
      name: 'Git Clone',
      icon: 'code-fork',
      action: importFromGit,
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
      {
        id: 'mock-server',
        label: `Mock (${mockServersCount})`,
        icon: 'server',
        action: {
          icon: 'plus',
          label: 'New Mock Server',
          run: createNewMockServer,
        },
      },
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
  const defaultStorageSelection = storage === 'local_only' ? 'local' : 'remote';
  const isRemoteProjectInconsistent = activeProject && isRemoteProject(activeProject) && storage === 'local_only';
  const isLocalProjectInconsistent = activeProject && !isRemoteProject(activeProject) && storage === 'cloud_only';
  const isProjectInconsistent = isRemoteProjectInconsistent || isLocalProjectInconsistent;
  const showStorageRestrictionMessage = storage !== 'cloud_plus_local';

  useEffect(() => {
    window.main.landingPageRendered(LandingPage.ProjectDashboard);
  }, []);

  const nextProjectId = useRef<string>();
  const startSwitchProjectTime = useRef<number>();

  useEffect(() => {
    if (nextProjectId.current && startSwitchProjectTime.current && nextProjectId.current === projectId) {
      const duration = performance.now() - startSwitchProjectTime.current;
      Sentry.metrics.distribution(SentryMetrics.PROJECT_SWITCH_DURATION, duration, {
        unit: 'millisecond',
      });
      nextProjectId.current = undefined;
      startSwitchProjectTime.current = undefined;
    }
  }, [projectId]);

  return (
    <ErrorBoundary>
      <Fragment>
        <PanelGroup autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
          <Panel id="sidebar" className='sidebar theme--sidebar' defaultSize={DEFAULT_SIDEBAR_SIZE} maxSize={40} minSize={10} collapsible>
            <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
              <div className="p-[--padding-sm]">
                <Select
                  aria-label="Organizations"
                  onSelectionChange={id => {
                    navigate(`/organization/${id}`);
                  }}
                  selectedKey={organizationId}
                >
                  <Button className="px-4 py-1 font-bold flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                    <SelectValue<Organization> className="flex truncate items-center justify-center gap-2">
                      {({ selectedItem }) => {
                        return selectedItem?.display_name || 'Select an organization';
                      }}
                    </SelectValue>
                    <Icon icon="caret-down" />
                  </Button>
                  <Popover className="min-w-max">
                    <ListBox
                      items={organizations}
                      className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                    >
                      {item => (
                        <ListBoxItem
                          id={item.id}
                          key={item.id}
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label={item.display_name}
                          textValue={item.display_name}
                          value={item}
                        >
                          {({ isSelected }) => (
                            <Fragment>
                              <span>{item.display_name}</span>
                              {isSelected && (
                                <Icon
                                  icon="check"
                                  className="text-[--color-success] justify-self-end"
                                />
                              )}
                            </Fragment>
                          )}
                        </ListBoxItem>
                      )}
                    </ListBox>
                  </Popover>
                </Select>
              </div>
              <div className="flex overflow-hidden flex-col flex-1">
                <Heading className="p-[--padding-sm] uppercase text-xs">
                  Projects ({projectsCount})
                </Heading>
                <div className="flex justify-between gap-1 p-[--padding-sm]">
                  <SearchField
                    aria-label="Projects filter"
                    className="group relative flex-1"
                    value={projectListFilter}
                    onChange={setProjectListFilter}
                  >
                    <Input
                      placeholder="Filter"
                      className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                    />
                    <div className="flex items-center px-2 absolute right-0 top-0 h-full">
                      <Button className="flex group-data-[empty]:hidden items-center justify-center aspect-square w-5 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                        <Icon icon="close" />
                      </Button>
                    </div>
                  </SearchField>
                  <Button
                    aria-label="Create new Project"
                    onPress={() => setIsNewProjectModalOpen(true)}
                    className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="plus-circle" />
                  </Button>
                </div>

                <GridList
                  aria-label="Projects"
                  items={projectsWithPresence}
                  className="overflow-y-auto flex-1 data-[empty]:py-0 py-[--padding-sm]"
                  disallowEmptySelection
                  selectedKeys={[activeProject?._id || '']}
                  selectionMode="single"
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      const value = keys.values().next().value;
                      nextProjectId.current = value;
                      startSwitchProjectTime.current = performance.now();
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
                        className="group outline-none select-none"
                      >
                        <div className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]">
                          <span className="group-aria-selected:bg-[--color-surprise] transition-colors top-0 left-0 absolute h-full w-[2px] bg-transparent" />
                          <Icon
                            icon={
                              isRemoteProject(item) ? 'globe-americas' : 'laptop'
                            }
                          />
                          <span className={item.hasUncommittedOrUnpushedChanges ? 'text-[--color-warning] truncate' : 'truncate'}>{item.name}</span>
                          <span className="flex-1" />
                          {item.presence.length > 0 && <AvatarGroup
                            size="small"
                            maxAvatars={3}
                            items={item.presence}
                          />}
                          {item._id !== SCRATCHPAD_PROJECT_ID && <ProjectDropdown hasUncommittedOrUnpushedChanges={item.hasUncommittedOrUnpushedChanges} organizationId={organizationId} project={item} storage={storage} />}
                        </div>
                      </GridListItem>
                    );
                  }}
                </GridList>
              </div>
              {activeProject && (
                <GridList
                  aria-label="Scope filter"
                  items={scopeActionList}
                  className="overflow-y-auto flex-shrink-0 flex-1 data-[empty]:py-0 py-[--padding-sm]"
                  disallowEmptySelection
                  selectedKeys={[workspaceListScope || 'all']}
                  selectionMode="single"
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      const value = keys.values().next().value;

                      setWorkspaceListScope(value);
                    }
                  }}
                >
                  {item => {
                    return (
                      <GridListItem textValue={item.label} className="group outline-none select-none">
                        <div
                          className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-aria-selected:bg-[--hl-sm] group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-12 w-full overflow-hidden text-[--hl]"
                        >
                          <span className='w-6 h-6 flex items-center justify-center'>
                            <Icon icon={item.icon} className='w-6' />
                          </span>

                          <span className="truncate capitalize">
                            {item.label}
                          </span>
                          <span className="flex-1" />
                          {item.action && (
                            <Button
                              onPress={item.action.run}
                              aria-label={item.action.label}
                              className="opacity-80 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                            >
                              <Icon icon={item.action.icon} />
                            </Button>
                          )}
                        </div>
                      </GridListItem>
                    );
                  }}
                </GridList>
              )}
              {!isLearningFeatureDismissed && learningFeature?.active && (
                <div className='flex flex-shrink-0 flex-col gap-2 p-[--padding-sm]'>
                  <div className='flex items-center justify-between gap-2'>
                    <Heading className='text-base'>
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
                  <p className='text-[--hl] text-sm'>
                    {learningFeature.message}
                  </p>
                  <a href={learningFeature.url} className='flex items-center gap-2 underline text-sm'>
                    {learningFeature.cta}
                    <Icon icon="arrow-up-right-from-square" />
                  </a>
                </div>
              )}
            </div>
          </Panel>
          <PanelResizeHandle className='h-full w-[1px] bg-[--hl-md]' />
          <Panel id="pane-one" className='pane-one theme--pane'>
            {activeProject ? (
              <div className="w-full h-full flex flex-col overflow-hidden">
                {billing.isActive ? null : <div className='p-[--padding-md] pb-0'>
                  <div className='flex flex-wrap justify-between items-center gap-2 p-[--padding-sm] border border-solid border-[--hl-md] bg-opacity-50 bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] text-[--color-font-warning] rounded'>
                    <p className='text-base'>
                      <Icon icon="exclamation-triangle" className='mr-2' />
                      {isUserOwner ? `Your ${isPersonalOrg ? 'personal account' : 'organization'} has unpaid past invoices. Please enter a new payment method to continue using Insomnia.` : 'This organization has unpaid past invoices. Please ask the organization owner to enter a new payment method to continue using Insomnia.'}
                    </p>
                    {isUserOwner && (
                      <a
                        href={`${getAppWebsiteBaseURL()}/app/subscription/past-due`}
                        className="px-4 text-[--color-bg] bg-opacity-100 bg-[rgba(var(--color-font-rgb),var(--tw-bg-opacity))] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-sm hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      >
                        Update payment method
                      </a>
                    )}
                  </div>
                </div>}
                {isProjectInconsistent && <div className='p-[--padding-md] pb-0'>
                  <div className='flex flex-wrap justify-between items-center gap-2 p-[--padding-sm] border border-solid border-[--hl-md] bg-opacity-50 bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] text-[--color-font-warning] rounded'>
                    <p className='text-base'>
                      <Icon icon="exclamation-triangle" className='mr-2' />
                      The organization owner mandates that projects must be created and stored {storage.split('_').join(' ')}. However, you can optionally enable Git Sync.
                    </p>
                    <Button onPress={() => setIsUpdateProjectModalOpen(true)} className="flex items-center justify-center border border-solid border-white px-2 py-1 rounded-sm">Update</Button>
                  </div>
                </div>}
                <div className="flex max-w-xl justify-between w-full gap-2 p-[--padding-md]">
                  <SearchField
                    aria-label="Files filter"
                    className="group relative flex-1"
                    value={workspaceListFilter}
                    onChange={filter => setWorkspaceListFilter(filter)}
                  >
                    <Input
                      placeholder="Filter"
                      className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                    />
                    <div className="flex items-center px-2 absolute right-0 top-0 h-full">
                      <Button className="flex group-data-[empty]:hidden items-center justify-center aspect-square w-5 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                        <Icon icon="close" />
                      </Button>
                    </div>
                  </SearchField>
                  <Select
                    aria-label="Sort order"
                    className="h-full aspect-square"
                    selectedKey={workspaceListSortOrder}
                    onSelectionChange={order => setWorkspaceListSortOrder(order as DashboardSortOrder)}
                  >
                    <Button
                      aria-label="Select sort order"
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-full bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="sort" />
                    </Button>
                    <Popover className="min-w-max">
                      <ListBox
                        items={DASHBOARD_SORT_ORDERS.map(order => {
                          return {
                            id: order,
                            name: dashboardSortOrderName[order],
                          };
                        })}
                        className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                      >
                        {item => (
                          <ListBoxItem
                            id={item.id}
                            key={item.id}
                            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                            aria-label={item.name}
                            textValue={item.name}
                            value={item}
                          >
                            {({ isSelected }) => (
                              <Fragment>
                                <span>{item.name}</span>
                                {isSelected && (
                                  <Icon
                                    icon="check"
                                    className="text-[--color-success] justify-self-end"
                                  />
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
                      className="flex items-center justify-center px-4 gap-2 h-full bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="plus-circle" /> Create
                    </Button>
                    <Popover className="min-w-max">
                      <Menu
                        aria-label="Create in project actions"
                        selectionMode="single"
                        onAction={key => {
                          const item = createInProjectActionList.find(
                            item => item.id === key
                          );
                          if (item) {
                            item.action();
                          }
                        }}
                        items={createInProjectActionList}
                        className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                      >
                        {item => (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
                      setImportModalType('file');
                    }}
                    aria-label="Import"
                    className="flex items-center justify-center px-4 gap-2 h-full bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="file-import" /> Import
                  </Button>

                </div>

                <div className='flex-1 overflow-y-auto'>
                  <GridList
                    aria-label="Files"
                    className="data-[empty]:flex data-[empty]:justify-center grid [grid-template-columns:repeat(auto-fit,200px)] [grid-template-rows:repeat(auto-fit,200px)] gap-4 p-[--padding-md]"
                    items={filesWithPresence}
                    renderEmptyState={() => {
                      if (workspaceListFilter) {
                        return (
                          <div className="w-full h-full flex items-center justify-center">
                            <p className="notice subtle">
                              No documents found for <strong>{workspaceListFilter}</strong>
                            </p>
                          </div>
                        );
                      }

                      return (
                        <EmptyStatePane
                          createRequestCollection={createNewCollection}
                          createDesignDocument={createNewDocument}
                          createMockServer={createNewMockServer}
                          createEnvironment={createNewGlobalEnvironment}
                          importFrom={() => setImportModalType('file')}
                          cloneFromGit={importFromGit}
                          isGitSyncEnabled={isGitSyncEnabled}
                        />
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
                          className={`flex-1 overflow-hidden flex-col outline-none p-[--padding-md] flex select-none w-full rounded-md hover:shadow-md aspect-square ring-1 ring-[--hl-md] hover:ring-[--hl-sm] focus:ring-[--hl-lg] hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-all ${item.loading ? 'animate-pulse' : ''}`}
                        >
                          <div className="flex gap-2 h-[20px]">
                            <div className="flex pr-2 h-full flex-shrink-0 items-center rounded-sm gap-2 bg-[--hl-xs] text-[--color-font] text-sm">
                              <div className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm`}>
                                <Icon icon={item.loading ? 'spinner' : scopeToIconMap[item.scope]} className={item.loading ? 'animate-spin' : ''} />
                              </div>
                              <span>{item.label}</span>
                            </div>
                            {(item.hasUncommittedChanges || item.hasUnpushedChanges) && <div className='flex items-center justify-center'>
                              <Icon icon="circle" className='group-focus:hidden group-hover:hidden w-2 h-2' color="var(--color-warning)" />
                            </div>}
                            <span className="flex-1" />
                            {item.presence.length > 0 && (
                              <AvatarGroup
                                size="small"
                                maxAvatars={3}
                                items={item.presence}
                              />
                            )}
                            {activeProject && item.scope !== 'unsynced' && item.workspace && (
                              <WorkspaceCardDropdown
                                workspace={item.workspace}
                                apiSpec={item.apiSpec}
                                project={activeProject}
                                projects={projects}
                              />
                            )}
                          </div>
                          <TooltipTrigger>
                            <Link
                              onPress={item.action}
                              className="pt-4 text-base font-bold line-clamp-4 outline-none"
                            >
                              {item.name}
                            </Link>
                            <Tooltip
                              offset={8}
                              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                            >
                              <span>{item.name}</span>
                            </Tooltip>
                          </TooltipTrigger>
                          <div className="flex-1 flex flex-col gap-2 justify-end text-sm text-[--hl]">
                            {item.version && (
                              <div className="flex-1 pt-2">
                                {item.version}
                              </div>
                            )}
                            {item.oasFormat && (
                              <div className="text-sm flex items-center gap-2">
                                <Icon icon="file-alt" />
                                <span>
                                  {item.oasFormat}
                                </span>
                              </div>
                            )}
                            {item.branch && (
                              <div className="text-sm flex items-center gap-2">
                                <Icon icon="code-branch" />
                                <span className="truncate">
                                  {item.branch}
                                </span>
                              </div>
                            )}
                            {Boolean(item.lastModifiedTimestamp) && (
                              <div className="text-sm flex items-center gap-2 truncate">
                                <Icon icon="clock" />
                                <TimeFromNow
                                  title={text => `Last updated ${text}, and created on ${new Date(item.created).toLocaleDateString()}`}
                                  timestamp={
                                    item.lastModifiedTimestamp
                                  }
                                />
                                <span className="truncate">
                                  {item.lastCommit}
                                </span>
                              </div>
                            )}
                            {(item.hasUncommittedChanges || item.hasUnpushedChanges) && (
                              <div className="text-sm text-[--color-warning] flex items-center gap-2">
                                <span>
                                  {item.hasUncommittedChanges ? 'Uncommitted changes' : 'Unpushed changes'}
                                </span>
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
              <div className="w-full h-full flex flex-col gap-2 items-center justify-center overflow-hidden">
                <p className='text-lg'>
                  This is an empty Organization. To get started create your first project.
                </p>
                <Button
                  aria-label="Create new Project"
                  onPress={() => setIsNewProjectModalOpen(true)}
                  className="flex items-center justify-center px-4 gap-2 py-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                >
                  <Icon icon="plus-circle" /> Create a new Project
                </Button>
              </div>
            )}
          </Panel>
        </PanelGroup>
        {isGitRepositoryCloneModalOpen && (
          <GitRepositoryCloneModal
            onHide={() => setIsGitRepositoryCloneModalOpen(false)}
          />
        )}
        <ModalOverlay isOpen={isNewProjectModalOpen} onOpenChange={isOpen => setIsNewProjectModalOpen(isOpen)} isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30">
          <Modal className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
            <Dialog className="outline-none" aria-label='Create or update dialog'>
              {({ close }) => (
                <div className='flex flex-col gap-4'>
                  <div className='flex gap-2 items-center justify-between'>
                    <Heading slot="title" className='text-2xl'>Create a new project</Heading>
                    <Button
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <form
                    className='flex flex-col gap-4'
                    onSubmit={e => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const type = formData.get('type');

                      if (!type) {
                        showAlert({
                          title: 'Project type not selected',
                          message: 'Please select a project type before continuing',
                        });
                        return;
                      }

                      createNewProjectFetcher.submit(e.currentTarget, {
                        action: `/organization/${organizationId}/project/new`,
                        method: 'post',
                      });

                      close();
                    }}
                  >
                    <TextField
                      autoFocus
                      name="name"
                      defaultValue="My project"
                      className="group relative flex-1 flex flex-col gap-2"
                    >
                      <Label className='text-sm text-[--hl]'>
                        Project name
                      </Label>
                      <Input
                        placeholder="My project"
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                    </TextField>
                    <RadioGroup name="type" defaultValue={defaultStorageSelection} className="flex flex-col gap-2">
                      <Label className="text-sm text-[--hl]">
                        Project type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          isDisabled={storage === 'local_only'}
                          value="remote"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Sync</Heading>
                          </div>
                          <p className='pt-2'>
                            Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                          </p>
                        </Radio>
                        <Radio
                          isDisabled={storage === 'cloud_only'}
                          value="local"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="laptop" />
                            <Heading className="text-lg font-bold">Local Vault</Heading>
                          </div>
                          <p className="pt-2">
                            Stored locally only with no cloud. Ideal when collaboration is not needed.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                    <div className="flex justify-between gap-2 items-center">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon icon="info-circle" />
                        <span>
                          {showStorageRestrictionMessage && `The organization owner mandates that projects must be created and stored ${storage.split('_').join(' ')}.`} You can optionally enable Git Sync
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Button
                          onPress={close}
                          className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        >
                          Create
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
        <ModalOverlay
          isOpen={isUpdateProjectModalOpen}
          onOpenChange={isOpen => {
            setProjectType('');
            setIsUpdateProjectModalOpen(isOpen);
          }}
          isDismissable
          className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={isOpen => {
              setProjectType('');
              setIsUpdateProjectModalOpen(isOpen);
            }}
            className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
          >
            <Dialog
              className="outline-none"
            >
              {({ close }) => (
                <div className='flex flex-col gap-4'>
                  <div className='flex gap-2 items-center justify-between'>
                    <Heading className='text-2xl'>{projectType === 'local' ? 'Confirm conversion to local storage' : projectType === 'remote' ? 'Confirm cloud synchronization' : 'Project Settings'}</Heading>
                    <Button
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <form
                    className='flex flex-col gap-4'
                    onSubmit={e => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const type = formData.get('type');
                      // If the project is local and the user is trying to change it to remote
                      if (type === 'remote' && !activeProject?.remoteId && !projectType) {
                        setProjectType('remote');
                        // If the project is remote and the user is trying to change it to local
                      } else if (type === 'local' && activeProject?.remoteId && !projectType) {
                        setProjectType('local');
                      } else {
                        if (!type) {
                          showAlert({
                            title: 'Project type not selected',
                            message: 'Please select a project type before continuing',
                          });
                          return;
                        }

                        updateProjectFetcher.submit(formData, {
                          action: `/organization/${organizationId}/project/${projectId}/update`,
                          method: 'post',
                        });

                        close();
                      }
                    }}
                  >
                    <div className={`flex flex-col gap-4 ${projectType ? 'hidden' : ''}`}>
                      <TextField
                        autoFocus
                        name="name"
                        defaultValue={activeProject?.name}
                        className="group relative flex-1 flex flex-col gap-2"
                      >
                        <Label className='text-sm text-[--hl]'>
                          Project name
                        </Label>
                        <Input
                          placeholder="My project"
                          className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                        />
                      </TextField>
                      <RadioGroup name="type" defaultValue={storage === 'cloud_plus_local' ? activeProject?.remoteId ? 'remote' : 'local' : storage !== 'cloud_only' ? 'local' : 'remote'} className="flex flex-col gap-2">
                        <Label className="text-sm text-[--hl]">
                          Project type
                        </Label>
                        <div className="flex gap-2">
                          <Radio
                            isDisabled={storage === 'local_only'}
                            value="remote"
                            className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                          >
                            <div className='flex items-center gap-2'>
                              <Icon icon="globe" />
                              <Heading className="text-lg font-bold">Cloud Sync</Heading>
                            </div>
                            <p className='pt-2'>
                              Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                            </p>
                          </Radio>
                          <Radio
                            isDisabled={storage === 'cloud_only'}
                            value="local"
                            className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                          >
                            <div className='flex items-center gap-2'>
                              <Icon icon="laptop" />
                              <Heading className="text-lg font-bold">Local Vault</Heading>
                            </div>
                            <p className="pt-2">
                              Stored locally only with no cloud. Ideal when collaboration is not needed.
                            </p>
                          </Radio>
                        </div>
                      </RadioGroup>
                    </div>

                    {projectType === 'local' && (
                      <div className='text-[--color-font] flex flex-col gap-4'>
                        <div className='flex flex-col gap-4'>
                          <p>
                            We will be converting your Cloud Sync project into a local project, and permanently remove all cloud data for this project from the cloud.
                          </p>
                          <ul className='text-left flex flex-col gap-2'>
                            <li><i className="fa fa-check text-emerald-600" /> The project will be 100% stored locally.</li>
                            <li><i className="fa fa-check text-emerald-600" /> Your collaborators will not be able to push and pull files anymore.</li>
                            <li><i className="fa fa-check text-emerald-600" /> The project will become local also for every existing collaborator.</li>
                          </ul>
                          <p>
                            You can still use Git Sync for local projects without using the cloud, and you can synchronize a local project back to the cloud if you decide to do so.
                          </p>
                          <p className='flex gap-2 items-center'>
                            <Icon icon="triangle-exclamation" className='text-[--color-warning]' />
                            Remember to pull your latest project updates before this operation
                          </p>
                        </div>
                      </div>
                    )}
                    {projectType === 'remote' && (
                      <div className='text-[--color-font] flex flex-col gap-4'>
                        <div className='flex flex-col gap-4'>
                          <p>
                            We will be synchronizing your local project to Insomnia's Cloud in a secure encrypted format which will enable cloud collaboration.
                          </p>
                          <ul className='text-left flex flex-col gap-2'>
                            <li><i className="fa fa-check text-emerald-600" /> Your data in the cloud is encrypted and secure.</li>
                            <li><i className="fa fa-check text-emerald-600" /> You can now collaborate with any amount of users and use cloud features.</li>
                            <li><i className="fa fa-check text-emerald-600" /> Your project will be always available on any client after logging in.</li>
                          </ul>
                          <p>
                            You can still use Git Sync for cloud projects.
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between gap-2 items-center">
                      <div className="flex items-center gap-2 text-sm">
                        <Icon icon="info-circle" />
                        <span>
                          {showStorageRestrictionMessage && `The organization owner mandates that projects must be created and stored ${storage.split('_').join(' ')}.`} You can optionally enable Git Sync
                        </span>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Button
                          onPress={() => {
                            if (projectType) {
                              setProjectType('');
                            } else {
                              close();
                            }
                          }}
                          className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        >
                          {projectType ? 'Confirm' : 'Update'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
        {activeProject && importModalType && (
          <ImportModal
            onHide={() => setImportModalType(null)}
            projectName={activeProject.name}
            from={{ type: importModalType }}
            organizationId={organizationId}
            defaultProjectId={activeProject._id}
          />
        )}
        {isMockServerSettingsModalOpen && (
          <MockServerSettingsModal
            onClose={() => setIsMockServerSettingsModalOpen(false)}
          />
        )}
      </Fragment>
    </ErrorBoundary>
  );
};

export default ProjectRoute;
