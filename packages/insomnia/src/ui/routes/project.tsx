import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  GridList,
  Heading,
  Input,
  Item,
  ListBox,
  Menu,
  MenuTrigger,
  Popover,
  SearchField,
  Select,
  SelectValue,
} from 'react-aria-components';
import {
  LoaderFunction,
  matchPath,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';

import { getAccountId, getCurrentSessionId, isLoggedIn, logout } from '../../account/session';
import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  DASHBOARD_SORT_ORDERS,
  DashboardSortOrder,
  dashboardSortOrderName,
  getAppWebsiteBaseURL,
} from '../../common/constants';
import { database } from '../../common/database';
import { fuzzyMatchAll, isNotNullOrUndefined } from '../../common/misc';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import { strings } from '../../common/strings';
import * as models from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { CaCertificate } from '../../models/ca-certificate';
import { ClientCertificate } from '../../models/client-certificate';
import { sortProjects } from '../../models/helpers/project';
import { isOwnerOfOrganization, isScratchpadOrganizationId } from '../../models/organization';
import { Organization } from '../../models/organization';
import {
  isRemoteProject,
  Project,
  SCRATCHPAD_PROJECT_ID,
} from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { showModal } from '../../ui/components/modals';
import { AskModal } from '../../ui/components/modals/ask-modal';
import { invariant } from '../../utils/invariant';
import { AvatarGroup } from '../components/avatar';
import { ProjectDropdown } from '../components/dropdowns/project-dropdown';
import { RemoteWorkspacesDropdown } from '../components/dropdowns/remote-workspaces-dropdown';
import { WorkspaceCardDropdown } from '../components/dropdowns/workspace-card-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { showAlert, showPrompt } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { GitRepositoryCloneModal } from '../components/modals/git-repository-settings-modal/git-repo-clone-modal';
import { ImportModal } from '../components/modals/import-modal';
import { EmptyStatePane } from '../components/panes/project-empty-state-pane';
import { SidebarLayout } from '../components/sidebar-layout';
import { TimeFromNow } from '../components/time-from-now';
import { usePresenceContext } from '../context/app/presence-context';
import { type FeatureList, useOrganizationLoaderData } from './organization';

interface TeamProject {
  id: string;
  name: string;
}

async function getAllTeamProjects(organizationId: string) {
  const sessionId = getCurrentSessionId() || '';
  console.log('Fetching projects for team', organizationId);
  if (!sessionId) {
    return [];
  }

  const response = await window.main.insomniaFetch<{
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

export interface WorkspaceWithMetadata {
  _id: string;
  hasUnsavedChanges: boolean;
  lastModifiedTimestamp: number;
  created: number;
  modifiedLocally: number;
  lastCommitTime: number | null | undefined;
  lastCommitAuthor: string | null | undefined;
  lastActiveBranch: string | null | undefined;
  spec: Record<string, any> | null;
  specFormat: 'openapi' | 'swagger' | null;
  name: string;
  apiSpec: ApiSpec | null;
  specFormatVersion: string | null;
  workspace: Workspace;
  workspaceMeta: WorkspaceMeta;
  clientCertificates: ClientCertificate[];
  caCertificate: CaCertificate | null;
}

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

  // Remove any remote projects from the current organization that are not in the list of remote projects
  const removedRemoteProjects = await database.find<Project>(models.project.type, {
    // filter by this organization so no legacy data can be accidentally removed, because legacy had null parentId
    parentId: organizationId,
    // Remote ID is not in the list of remote projects
    remoteId: { $nin: teamProjects.map(p => p.id) },
  });

  await Promise.all(removedRemoteProjects.map(async prj => {
    await models.project.remove(prj);
  }));
}

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  // When org icon is clicked this ensures we remember the last visited page
  const prevOrganizationLocation = localStorage.getItem(
    `locationHistoryEntry:${organizationId}`
  );

  let teamProjects: TeamProject[] = [];

  try {
    teamProjects = await getAllTeamProjects(organizationId);
    // ensure we don't sync projects in the wrong place
    if (teamProjects.length > 0 && isLoggedIn() && !isScratchpadOrganizationId(organizationId)) {
      await syncTeamProjects({
        organizationId,
        teamProjects,
      });
    }
  } catch (err) {
    console.log('Could not fetch remote projects.');
  }

  // Check if the last visited project exists and redirect to it
  if (prevOrganizationLocation) {
    const match = matchPath(
      {
        path: '/organization/:organizationId/project/:projectId',
        end: false,
      },
      prevOrganizationLocation
    );

    if (match && match.params.organizationId && match.params.projectId) {
      const existingProject = await models.project.getById(match.params.projectId);

      if (existingProject) {
        console.log('Redirecting to last visited project', existingProject._id);
        return redirect(`/organization/${match?.params.organizationId}/project/${existingProject._id}`);
      }
    }
  }

  const allOrganizationProjects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  }) || [];

  // Check if the org has any projects and redirect to the first one
  const projectId = allOrganizationProjects[0]?._id;

  invariant(projectId, 'No projects found for this organization.');

  return redirect(`/organization/${organizationId}/project/${projectId}`);

};

export interface ProjectsLoaderData {
  activeProject: Project;
}

export const projectLoader: LoaderFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const projectPath = matchPath('/organization/:organizationId/project/:projectId', url.pathname);

    if (!projectPath || !projectPath.params.projectId) {
      return null;
    }

    const activeProject = await models.project.getById(projectPath.params.projectId);
    invariant(activeProject, `Project was not found ${projectPath.params.projectId}`);

    return {
      activeProject,
    };
  } catch (err) {
    return null;
  }
};

export interface ProjectLoaderData {
  workspaces: WorkspaceWithMetadata[];
  allFilesCount: number;
  documentsCount: number;
  collectionsCount: number;
  projectsCount: number;
  activeProject: Project;
  projects: Project[];
}

export const loader: LoaderFunction = async ({
  params,
  request,
}): Promise<ProjectLoaderData> => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  const sessionId = getCurrentSessionId();

  if (!sessionId) {
    await logout();
    throw redirect('/auth/login');
  }
  const search = new URL(request.url).searchParams;
  invariant(projectId, 'projectId parameter is required');
  const sortOrder = search.get('sortOrder') || 'modified-desc';
  const filter = search.get('filter') || '';
  const scope = search.get('scope') || 'all';
  const projectName = search.get('projectName') || '';

  const project = await models.project.getById(projectId);
  invariant(project, `Project was not found ${projectId}`);

  const projectWorkspaces = await models.workspace.findByParentId(projectId);

  const getWorkspaceMetaData = async (
    workspace: Workspace
  ): Promise<WorkspaceWithMetadata> => {
    const apiSpec = await models.apiSpec.getByParentId(workspace._id);

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
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(
      workspace._id
    );
    invariant(workspaceMeta, 'WorkspaceMeta was not found');
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

    const clientCertificates = await models.clientCertificate.findByParentId(
      workspace._id
    );

    return {
      _id: workspace._id,
      hasUnsavedChanges,
      lastModifiedTimestamp,
      created: workspace.created,
      modifiedLocally,
      lastCommitTime: workspaceMeta?.cachedGitLastCommitTime,
      lastCommitAuthor,
      lastActiveBranch,
      spec,
      specFormat,
      name: workspace.name,
      apiSpec,
      specFormatVersion,
      workspaceMeta,
      clientCertificates,
      caCertificate: await models.caCertificate.findByParentId(workspace._id),
      workspace,
    };
  };

  // Fetch all workspace meta data in parallel
  const workspacesWithMetaData = await Promise.all(
    projectWorkspaces.map(getWorkspaceMetaData)
  );

  const workspaces = workspacesWithMetaData
    .filter(w => (scope !== 'all' ? w.workspace.scope === scope : true))
    // @TODO - Figure out if the database has a way to sort/filter items that could replace this logic.
    .filter(workspace =>
      filter
        ? Boolean(
            fuzzyMatchAll(
              filter,
              // Use the filter string to match against these properties
              [
                workspace.name,
                workspace.workspace.scope === 'design'
                  ? 'document'
                  : 'collection',
                workspace.lastActiveBranch || '',
                workspace.specFormatVersion || '',
              ],
              { splitSpace: true, loose: true }
            )?.indexes
          )
        : true
    )
    .sort((a, b) => sortMethodMap[sortOrder as DashboardSortOrder](a, b));

  const organizationProjects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  }) || [];

  const projects = sortProjects(organizationProjects).filter(p =>
    p.name?.toLowerCase().includes(projectName.toLowerCase())
  );

  return {
    workspaces,
    projects,
    projectsCount: organizationProjects.length,
    activeProject: project,
    allFilesCount: workspacesWithMetaData.length,
    documentsCount: workspacesWithMetaData.filter(
      w => w.workspace.scope === 'design'
    ).length,
    collectionsCount: workspacesWithMetaData.filter(
      w => w.workspace.scope === 'collection'
    ).length,
  };
};

const ProjectRoute: FC = () => {
  const {
    workspaces,
    activeProject,
    projects,
    allFilesCount,
    collectionsCount,
    documentsCount,
    projectsCount,
  } = useLoaderData() as ProjectLoaderData;

  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const { organizations } = useOrganizationLoaderData();
  const { presence } = usePresenceContext();
  const { features } = useRouteLoaderData(':organizationId') as { features: FeatureList };

  const accountId = getAccountId();

  const workspacesWithPresence = workspaces.map(workspace => {
    const workspacePresence = presence
      .filter(p => p.project === activeProject.remoteId && p.file === workspace._id)
      .filter(p => p.acct !== accountId)
      .map(user => {
        return {
          key: user.acct,
          alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
          src: user.avatar,
        };
      });
    return {
      ...workspace,
      presence: workspacePresence,
    };
  });

  const projectsWithPresence = projects.map(project => {
    const projectPresence = presence
      .filter(p => p.project === project.remoteId)
      .filter(p => p.acct !== accountId)
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
    };
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [isGitRepositoryCloneModalOpen, setIsGitRepositoryCloneModalOpen] =
    useState(false);

  const fetcher = useFetcher();
  const navigate = useNavigate();
  const filter = searchParams.get('filter') || '';
  const sortOrder =
    (searchParams.get('sortOrder') as DashboardSortOrder) || 'modified-desc';
  const [importModalType, setImportModalType] = useState<
    'uri' | 'file' | 'clipboard' | null
  >(null);

  const createNewCollection = () => {
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

  const createNewProjectFetcher = useFetcher();

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
  }, [createNewProjectFetcher.data, createNewProjectFetcher.state]);

  const currentOrg = organizations.find(organization => (organization.id === organizationId));
  const isGitSyncEnabled = features.gitSync.enabled;

  const showUpgradePlanModal = () => {
    if (!currentOrg || !accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId,
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
      id: 'import',
      name: 'Import',
      icon: 'file-import',
      action: () => {
        setImportModalType('file');
      },
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
    level: number;
    action?: {
      icon: IconName;
      label: string;
      run: () => void;
    };
  }[] = [
    {
      id: 'all',
      label: `All files (${allFilesCount})`,
      icon: 'folder',
      level: 0,
    },
    {
      id: 'design',
      label: `Documents (${documentsCount})`,
      level: 1,
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
      level: 1,
      icon: 'bars',
      action: {
        icon: 'plus',
        label: 'New request collection',
        run: createNewCollection,
      },
    },
  ];

  return (
    <ErrorBoundary>
      <Fragment>
        <SidebarLayout
          className="new-sidebar"
          renderPageSidebar={
            <div className="flex flex-1 flex-col overflow-hidden divide-solid divide-y divide-[--hl-md]">
              <div className="p-[--padding-sm]">
                <Select
                  aria-label="Organizations"
                  onSelectionChange={id => {
                    navigate(`/organization/${id}`);
                  }}
                  selectedKey={organizationId}
                  items={organizations}
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
                    <ListBox<Organization> className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none">
                      {item => (
                        <Item
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
                        </Item>
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
                    defaultValue={searchParams.get('filter')?.toString() ?? ''}
                    onChange={projectName => {
                      setSearchParams({
                        ...Object.fromEntries(searchParams.entries()),
                        projectName,
                      });
                    }}
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
                    onPress={() => {
                      const defaultValue = `My ${strings.project.singular}`;
                      showPrompt({
                        title: `Create New ${strings.project.singular}`,
                        submitName: 'Create',
                        placeholder: defaultValue,
                        defaultValue,
                        selectText: true,
                        onComplete: async name =>
                          createNewProjectFetcher.submit(
                            {
                              name,
                            },
                            {
                              action: `/organization/${organizationId}/project/new`,
                              method: 'post',
                            }
                          ),
                      });
                    }}
                    aria-label="Create new Project"
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
                  selectedKeys={[activeProject._id]}
                  selectionMode="single"
                  onSelectionChange={keys => {
                    if (keys !== 'all') {
                      const value = keys.values().next().value;
                      navigate({
                        pathname: `/organization/${organizationId}/project/${value}`,
                        search: searchParams.toString(),
                      });
                    }
                  }}
                >
                  {item => {
                    return (
                      <Item
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
                          <span className="truncate">{item.name}</span>
                          <span className="flex-1" />
                          <AvatarGroup
                            size="small"
                            maxAvatars={3}
                            items={item.presence}
                          />
                          {item._id !== SCRATCHPAD_PROJECT_ID && <ProjectDropdown organizationId={organizationId} project={item} />}
                        </div>
                      </Item>
                    );
                  }}
                </GridList>
              </div>
              <GridList
                aria-label="Scope filter"
                items={scopeActionList}
                className="overflow-y-auto flex-shrink-0 data-[empty]:py-0 py-[--padding-sm]"
                disallowEmptySelection
                selectedKeys={[searchParams.get('scope') || 'all']}
                selectionMode="single"
                onSelectionChange={keys => {
                  if (keys !== 'all') {
                    const value = keys.values().next().value;
                    setSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      scope: value,
                    });
                  }
                }}
              >
                {item => {
                  return (
                    <Item textValue={item.label} className="group outline-none select-none">
                      <div
                        className="flex select-none outline-none group-aria-selected:text-[--color-font] relative group-aria-selected:bg-[--hl-sm] group-hover:bg-[--hl-xs] group-focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                        style={{
                          paddingLeft: `${item.level + 1}rem`,
                        }}
                      >
                        <Icon icon={item.icon} />

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
                    </Item>
                  );
                }}
              </GridList>
              <div className='flex flex-shrink-0 flex-col py-[--padding-sm]'>
                <Button
                  aria-label="Invite collaborators"
                  className="outline-none select-none flex hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                  onPress={() => {
                    window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/dashboard/organizations/${organizationId}/collaborators`);
                  }}
                >
                  <Icon icon="user-plus" />

                  <span className="truncate">
                    Invite collaborators
                  </span>
                </Button>
                <Button
                  aria-label="Help and Feedback"
                  className="outline-none select-none flex hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-colors gap-2 px-4 items-center h-[--line-height-xs] w-full overflow-hidden text-[--hl]"
                  onPress={() => {
                    window.main.openInBrowser('https://insomnia.rest/support');
                  }}
                >
                  <Icon icon="message" />

                  <span className="truncate">
                    Help and feedback
                  </span>
                </Button>
              </div>
            </div>
          }
          renderPaneOne={
            <div className="w-full h-full flex flex-col overflow-hidden">
              <div className="flex justify-between w-full gap-1 p-[--padding-md]">
                <SearchField
                  aria-label="Workspaces filter"
                  className="group relative flex-1"
                  defaultValue={searchParams.get('filter')?.toString()}
                  onChange={filter => {
                    setSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      filter,
                    });
                  }}
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
                  selectedKey={sortOrder}
                  onSelectionChange={order =>
                    setSearchParams({
                      ...Object.fromEntries(searchParams.entries()),
                      sortOrder: order.toString(),
                    })
                  }
                  items={DASHBOARD_SORT_ORDERS.map(order => {
                    return {
                      id: order,
                      name: dashboardSortOrderName[order],
                    };
                  })}
                >
                  <Button
                    aria-label="Select sort order"
                    className="flex flex-shrink-0 items-center justify-center aspect-square h-full aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="sort" />
                  </Button>
                  <Popover className="min-w-max">
                    <ListBox<{
                      id: string;
                      name: string;
                    }> className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                    >
                      {item => (
                        <Item
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
                        </Item>
                      )}
                    </ListBox>
                  </Popover>
                </Select>

                <MenuTrigger>
                  <Button
                    aria-label="Create in project"
                    className="flex items-center justify-center h-full aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="plus-circle" />
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
                        <Item
                          key={item.id}
                          id={item.id}
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label={item.name}
                        >
                          <Icon icon={item.icon} />
                          <span>{item.name}</span>
                        </Item>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>
                {isRemoteProject(activeProject) && (
                  <RemoteWorkspacesDropdown
                    key={activeProject._id}
                    project={activeProject}
                  />
                )}
              </div>

              <GridList
                aria-label="Workspaces"
                items={workspacesWithPresence}
                onAction={key => {
                  navigate(
                    `/organization/${organizationId}/project/${projectId}/workspace/${key}/debug`
                  );
                }}
                className="flex-1 overflow-y-auto data-[empty]:flex data-[empty]:justify-center grid [grid-template-columns:repeat(auto-fit,200px)] [grid-template-rows:repeat(auto-fit,200px)] gap-4 p-[--padding-md]"
                renderEmptyState={() => {
                  if (filter) {
                    return (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="notice subtle">
                          No documents found for <strong>{filter}</strong>
                        </p>
                      </div>
                    );
                  }

                  return (
                    <EmptyStatePane
                      createRequestCollection={createNewCollection}
                      createDesignDocument={createNewDocument}
                      importFrom={() => setImportModalType('file')}
                      cloneFromGit={importFromGit}
                    />
                  );
                }}
              >
                {item => {
                  return (
                    <Item
                      key={item._id}
                      id={item._id}
                      textValue={item.name}
                      className="[&_[role=gridcell]]:flex-1 [&_[role=gridcell]]:overflow-hidden [&_[role=gridcell]]:flex [&_[role=gridcell]]:flex-col outline-none p-[--padding-md] flex select-none w-full rounded-sm hover:shadow-md aspect-square ring-1 ring-[--hl-md] hover:ring-[--hl-sm] focus:ring-[--hl-lg] hover:bg-[--hl-xs] focus:bg-[--hl-sm] transition-all"
                    >
                      <div className="flex gap-2 h-[20px]">
                        <div className="flex pr-2 h-full flex-shrink-0 items-center rounded-sm gap-2 bg-[--hl-xs] text-[--color-font] text-sm">
                          {isDesign(item.workspace) ? (
                            <div className="px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm bg-[--color-info] text-[--color-font-info]">
                              <Icon icon="file" />
                            </div>
                          ) : (
                              <div className="px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm bg-[--color-surprise] text-[--color-font-surprise]">
                              <Icon icon="bars" />
                            </div>
                          )}
                          <span>
                            {isDesign(item.workspace)
                              ? 'Document'
                              : 'Collection'}
                          </span>
                        </div>
                        <span className="flex-1" />
                        {item.presence.length > 0 && (
                          <AvatarGroup
                            size="small"
                            maxAvatars={3}
                            items={item.presence}
                          />
                        )}
                        <WorkspaceCardDropdown
                          {...item}
                          project={activeProject}
                          projects={projects}
                        />
                      </div>
                      <Heading className="pt-4 text-lg font-bold truncate">
                        {item.workspace.name}
                      </Heading>
                      <div className="flex-1 flex flex-col gap-2 justify-end text-sm text-[--hl]">
                        {typeof item.spec?.info?.version === 'string' && (
                          <div className="flex-1 pt-2">
                            {item.spec.info.version.startsWith('v') ? '' : 'v'}
                            {item.spec.info.version}
                          </div>
                        )}
                        {item.specFormat && (
                          <div className="text-sm flex items-center gap-2">
                            <Icon icon="file-alt" />
                            <span>
                              {item.specFormat === 'openapi'
                                ? 'OpenAPI'
                                : 'Swagger'}{' '}
                              {item.specFormatVersion}
                            </span>
                          </div>
                        )}
                        {item.lastActiveBranch && (
                          <div className="text-sm flex items-center gap-2">
                            <Icon icon="code-branch" />
                            <span className="truncate">
                              {item.lastActiveBranch}
                            </span>
                          </div>
                        )}
                        {item.lastModifiedTimestamp && (
                          <div className="text-sm flex items-center gap-2 truncate">
                            <Icon icon="clock" />
                            <TimeFromNow
                              timestamp={
                                (item.hasUnsavedChanges &&
                                  item.modifiedLocally) ||
                                item.lastCommitTime ||
                                item.lastModifiedTimestamp
                              }
                            />
                            <span className="truncate">
                              {!item.hasUnsavedChanges &&
                                item.lastCommitTime &&
                                item.lastCommitAuthor &&
                                `by ${item.lastCommitAuthor}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </Item>
                  );
                }}
              </GridList>
            </div>
          }
        />
        {isGitRepositoryCloneModalOpen && (
          <GitRepositoryCloneModal
            onHide={() => setIsGitRepositoryCloneModalOpen(false)}
          />
        )}
        {importModalType && (
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

export default ProjectRoute;
