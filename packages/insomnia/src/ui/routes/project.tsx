import React, { FC, Fragment, useRef, useState } from 'react';
import {
  AriaButtonProps,
  AriaGridListItemOptions,
  AriaGridListOptions,
  mergeProps,
  useButton,
  useFocusRing,
  useGridList,
  useGridListItem,
} from 'react-aria';
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
  useSubmit,
} from 'react-router-dom';
import { Item, ListProps, ListState, useListState } from 'react-stately';
import styled from 'styled-components';

import { getAccountId, getCurrentSessionId } from '../../account/session';
import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  DashboardSortOrder,
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
import {
  isRemoteProject,
  Project,
  RemoteProject,
} from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { invariant } from '../../utils/invariant';
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownSection,
  ItemContent,
} from '../components/base/dropdown';
import { DashboardSortDropdown } from '../components/dropdowns/dashboard-sort-dropdown';
import { ProjectDropdown } from '../components/dropdowns/project-dropdown';
import { RemoteWorkspacesDropdown } from '../components/dropdowns/remote-workspaces-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { showPrompt } from '../components/modals';
import { GitRepositoryCloneModal } from '../components/modals/git-repository-settings-modal/git-repo-clone-modal';
import { ImportModal } from '../components/modals/import-modal';
import { EmptyStatePane } from '../components/panes/project-empty-state-pane';
import { SidebarLayout } from '../components/sidebar-layout';
import { Button } from '../components/themed-button/button';
import { WorkspaceCard } from '../components/workspace-card';
import { usePresenceContext } from '../context/app/presence-context';
import { OrganizationLoaderData } from './organization';

async function getAllTeamProjects(teamId: string) {
  const sessionId = getCurrentSessionId() || '';

  if (!sessionId) {
    return [];
  }

  const response = await window.main.insomniaFetch<{
    data: {
      id: string;
      name: string;
    }[];
  }>({
    path: `/v1/teams/${teamId}/team-projects`,
    method: 'GET',
    sessionId,
  });

  return response.data;
}

const StyledDropdownButton = styled(DropdownButton).attrs({
  variant: 'outlined',
})({
  '&&': {
    marginLeft: 'var(--padding-md)',
    gap: 'var(--padding-sm)',
  },
});

const SearchFormControl = styled.div({
  position: 'relative',
  fontSize: 'var(--font-size-md)',
  maxWidth: '400px',
  minWidth: '200px',
});

const SearchInput = styled.input({
  '&&': {
    paddingRight: 'var(--padding-lg)!important',
    fontSize: 'var(--font-size-sm)',
  },
});

const PaneHeaderToolbar = styled.div({
  display: 'flex',
  boxSizing: 'border-box',
  justifyContent: 'space-between',
  flex: 0,
  gridColumn: '1 / -1',
  width: '100%',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  paddingTop: 'var(--padding-md)',
  paddingBottom: 'var(--padding-sm)',
  backgroundColor: 'var(--color-bg)',
});

const Pane = styled.div({
  position: 'relative',
  height: '100%',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--color-bg)',
  display: 'grid',
  gridAutoColumns: 'minmax(204px, auto)',
  gridTemplateColumns: 'repeat(auto-fit, 208px)',
  gridAutoRows: 'min-content',
  placeContent: 'start',
  overflow: 'auto',
  padding: '0 var(--padding-md) var(--padding-md) var(--padding-md)',
  gap: '1rem',
  flex: '1 0 auto',
  overflowY: 'auto',
});

const SidebarTitle = styled.h2({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
  padding: 'var(--padding-sm)',
  fontSize: 'var(--font-size-md)',
  margin: 0,
  paddingLeft: 'var(--padding-md)',
  borderBottom: '1px solid var(--hl-md)',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

const SidebarSection = styled.div({
  boxSizing: 'border-box',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'row',
  flexWrap: 'wrap',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--hl)',
  paddingRight: 'var(--padding-xs)',
  height: 'var(--height-nav)',

  // Make it scroll when too skinny
  overflow: 'auto',

  '&::-webkit-scrollbar': {
    display: 'none',
  },

  '& > *': {
    flex: '1',
    marginTop: 'var(--padding-xs)',
    marginBottom: 'var(--padding-xs)',
    maxWidth: '100%',
  },

  '& > .dropdown > *': {
    width: '100%',
  },

  '& > *:first-child': {
    marginRight: 'var(--padding-xxs)',
  },

  '& > *:last-child': {
    marginLeft: 'var(--padding-xxs)',
  },

  '.sidebar__menu__thing': {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',

    '& > .sidebar__menu__thing__text': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },

    'i.fa': {
      // Bump the drop down caret down a bit
      position: 'relative',
      top: '1px',
    },
  },

  '.btn': {
    borderRadius: '900px',
    height: 'var(--line-height-xxs)',
    paddingLeft: 'var(--padding-xxs)',
    paddingRight: 'var(--padding-xxs)',
    color: 'var(--color-font)',

    '&: hover, &:focus': {
      opacity: '1',
    },
  },
});

const SidebarSectionTitle = styled.h3({
  paddingLeft: 'var(--padding-md)',
  textTransform: 'uppercase',
  color: 'var(--color-font)',
  fontSize: 'var(--font-size-xs)',
});

const Sidebar = styled.div({
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const SidebarDivider = styled.span({
  width: '100%',
  borderTop: '1px solid var(--hl-md)',
  paddingBottom: 'var(--padding-md)',
});

const SearchFormContainer = styled.div({
  padding: 'var(--padding-xs)',
  paddingTop: 0,
});

const ProjectListContainer = styled.ul({
  flex: 1,
});

const OrganizationProjectsSidebar: FC<{
  title: string;
  projects: Project[];
  workspaces: Workspace[];
  activeProject: Project;
  organizationId: string;
  allFilesCount: number;
  documentsCount: number;
  collectionsCount: number;
  createNewCollection: () => void;
  createNewDocument: () => void;
}> = ({
  activeProject,
  projects,
  title,
  organizationId,
  collectionsCount,
  documentsCount,
  allFilesCount,
  createNewCollection,
  createNewDocument,
}) => {
  const createNewProjectFetcher = useFetcher();
  const { organizations } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const [isSearchOpen, setSearchOpen] = useState(false);

  return (
    <Sidebar
      style={{
        gridArea: '1 / 1 / -1 / -1',
      }}
    >
      <SidebarTitle>
        <Dropdown
          placement="bottom end"
          triggerButton={
            <DropdownButton>
              {title} <i className="fa fa-caret-down" />
            </DropdownButton>
          }
        >
          <DropdownSection items={organizations}>
            {organization => (
              <DropdownItem key={organization._id}>
                <ItemContent
                  label={organization.name}
                  isSelected={organization._id === organizationId}
                  onClick={() => {
                    navigate(`/organization/${organization._id}`);
                  }}
                />
              </DropdownItem>
            )}
          </DropdownSection>
        </Dropdown>
      </SidebarTitle>
      <SidebarSection>
        <SidebarSectionTitle>Projects ({projects.length})</SidebarSectionTitle>

        <Button
          style={{
            padding: 'var(--padding-sm)',
            minWidth: 'auto',
            width: 'unset',
            flex: 0,
          }}
          variant="text"
          size="small"
          onClick={() => {
            setSearchOpen(!isSearchOpen);
          }}
        >
          <i data-testid="SearchProjectsButton" className="fa fa-search" />
        </Button>
        <Button
          style={{
            padding: 'var(--padding-sm)',
            minWidth: 'auto',
            width: 'unset',
            flex: 0,
          }}
          variant="text"
          size="small"
          onClick={() => {
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
        >
          <i data-testid="CreateProjectButton" className="fa fa-plus" />
        </Button>
      </SidebarSection>
      {isSearchOpen && (
        <SearchFormContainer>
          <SearchFormControl className="form-control form-control--outlined no-margin">
            <SearchInput
              autoFocus
              type="text"
              placeholder="Filter by project name"
              onChange={event =>
                submit({
                  ...Object.fromEntries(searchParams.entries()),
                  projectName: event.target.value,
                })
              }
              className="no-margin"
            />
          </SearchFormControl>
        </SearchFormContainer>
      )}
      <ProjectListContainer className="sidebar__list sidebar__list-root theme--sidebar__list">
        {projects.map(proj => {
          return (
            <li key={proj._id} className="sidebar__row">
              <div
                className={`sidebar__item sidebar__item--request ${
                  activeProject._id === proj._id ? 'sidebar__item--active' : ''
                }`}
              >
                <button
                  style={{
                    paddingLeft: 'var(--padding-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--padding-sm)',
                  }}
                  onClick={() =>
                    navigate({
                      pathname: `/organization/${organizationId}/project/${proj._id}`,
                      search: searchParams.toString(),
                    })
                  }
                  className="wide"
                >
                  {isRemoteProject(activeProject) ? (
                    <i className="fa fa-globe" />
                  ) : (
                    <i className="fa fa-laptop" />
                  )}{' '}
                  {proj.name}
                </button>
                <div
                  style={{
                    display: 'flex',
                    height: '100%',
                    alignItems: 'center',
                    padding: '0 var(--padding-md)',
                  }}
                >
                  <ProjectDropdown
                    organizationId={organizationId}
                    project={proj}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ProjectListContainer>

      <SidebarDivider />

      <ProjectListContainer>
        <List
          aria-label="files-list"
          key="files-list"
          aria-label='Files List'
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[searchParams.get('scope') || 'all']}
          onSelectionChange={selection => {
            const scope = [...selection]?.[0]?.toString();

            if (scope) {
              submit({
                ...Object.fromEntries(searchParams.entries()),
                scope,
              });
            }
          }}
        >
          <Item key="all" aria-label="All Files">
            <SidebarListItemContent level={1}>
              <SidebarListItemTitle
                icon="folder"
                label={`All Files (${allFilesCount})`}
              />
            </SidebarListItemContent>
          </Item>
          <Item key="design" aria-label="Documents">
            <SidebarListItemContent level={2}>
              <SidebarListItemTitle
                icon="file"
                label={`Documents (${documentsCount})`}
              />
              <ListItemButton
                onPress={() => {
                  createNewDocument();
                }}
              >
                <i className="fa fa-plus" />
              </ListItemButton>
            </SidebarListItemContent>
          </Item>
          <Item key="collection" aria-label="Collections">
            <SidebarListItemContent level={2}>
              <SidebarListItemTitle
                icon="bars"
                label={`Collections (${collectionsCount})`}
              />
              <ListItemButton
                onPress={() => {
                  createNewCollection();
                }}
              >
                <i className="fa fa-plus" />
              </ListItemButton>
            </SidebarListItemContent>
          </Item>
        </List>
      </ProjectListContainer>

      <SidebarDivider
        style={{
          padding: 0,
        }}
      />

      <div
        style={{
          padding: 'var(--padding-sm) 0',
        }}
      >
        <List

          aria-label='Help and Feedback'
          onAction={key => {
            window.main.openInBrowser(key.toString());
          }}
        >
          <Item
            key={`${getAppWebsiteBaseURL()}/app/dashboard/teams/${organizationId}/members`}
            aria-label="Invite people to organization"
          >
            <SidebarListItemContent level={0}>
              <SidebarListItemTitle
                icon="plus"
                label="Invite people to organization"
              />
            </SidebarListItemContent>
          </Item>
          <Item
            key="https://insomnia.rest/pricing"
            aria-label="Explore Subscriptions"
          >
            <SidebarListItemContent level={0}>
              <SidebarListItemTitle
                icon="arrow-up-right-from-square"
                label="Explore Subscriptions"
              />
            </SidebarListItemContent>
          </Item>
          <Item
            key="https://github.com/Kong/insomnia/discussions"
            aria-label="Help and Feedback"
          >
            <SidebarListItemContent level={0}>
              <SidebarListItemTitle
                icon="message"
                label="Help and Feedback"
              />
            </SidebarListItemContent>
          </Item>
        </List>
      </div>
    </Sidebar>

  );
};

const ButtonWithoutHoverBackground = styled(Button)({
  '&&:hover': {
    backgroundColor: 'unset',
  },
});

const ListItemButton = (
  props: AriaButtonProps & {
    children: React.ReactNode;
  }
) => {
  const ref = useRef(null);
  const { buttonProps } = useButton(props, ref);

  return (
    <ButtonWithoutHoverBackground
      variant="text"
      size="xs"
      ref={ref}
      {...buttonProps}
    >
      {props.children}
    </ButtonWithoutHoverBackground>
  );
};

const SidebarListItemContent = styled.div<{
  level: number;
}>(props => ({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--padding-sm)',
  paddingLeft: `calc(var(--padding-md) * ${props.level || 1})`,
  boxSizing: 'border-box',
  position: 'relative',
}));

const StyledSidebarListItemTitle = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

interface SidebarListItemTitleProps {
  icon: string;
  label: string;
}

const SidebarListItemTitle = ({ icon, label }: SidebarListItemTitleProps) => {
  return (
    <StyledSidebarListItemTitle>
      <i className={`fa fa-${icon}`} /> {label}
    </StyledSidebarListItemTitle>
  );
};

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

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  const prevOrganizationLocation = localStorage.getItem(`locationHistoryEntry:${organizationId}`);

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
      let projectId = match.params.projectId;
      const existingProject = await models.project.getById(projectId);

      if (!existingProject) {
        projectId = (await models.project.all()).filter(proj => proj.parentId === organizationId)[0]?._id;
        if (!projectId) {
          return redirect('/organization');
        }
      }

      return redirect(`/organization/${match?.params.organizationId}/project/${projectId}`);
    }
  }

  // Check if the org has any projects and redirect to the first one
  const projectId = (await models.project.all()).filter(proj => proj.parentId === organizationId)[0]?._id;

  if (projectId) {
    return redirect(`/organization/${organizationId}/project/${projectId}`);
  }

  // Check if the org has any remote projects and redirect to the first one
  try {
    const remoteProjects = await getAllTeamProjects(organizationId);

    const projectsToUpdate = await Promise.all(remoteProjects.map(async (prj: {
        id: string;
        name: string;
      }) => models.initModel<RemoteProject>(
        models.project.type,
        {
          _id: prj.id,
          remoteId: prj.id,
          name: prj.name,
          parentId: organizationId,
        }
      )));

    await database.batchModifyDocs({ upsert: projectsToUpdate });

    return redirect(`/organization/${organizationId}/project/${projectsToUpdate[0]._id}`);
  } catch (err) {
    console.log(err);
    return redirect('/organization');
  }
};

export interface ProjectLoaderData {
  workspaces: WorkspaceWithMetadata[];
  allFilesCount: number;
  documentsCount: number;
  collectionsCount: number;
  activeProject: Project;
  projects: Project[];
}

export const loader: LoaderFunction = async ({
  params,
  request,
}): Promise<ProjectLoaderData> => {
  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    throw redirect('/auth/login');
  }
  const search = new URL(request.url).searchParams;
  const { organizationId } = params;
  let { projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'projectId parameter is required');
  const sortOrder = search.get('sortOrder') || 'modified-desc';
  const filter = search.get('filter') || '';
  const scope = search.get('scope') || 'all';
  const projectName = search.get('projectName') || '';
  const project = await models.project.getById(projectId);
  invariant(project, 'Project was not found');

  try {
    console.log('Fetching projects for team', organizationId);
    const remoteProjects = await getAllTeamProjects(organizationId);

    const projectsToUpdate = await Promise.all(remoteProjects.map(async (prj: {
      id: string;
      name: string;
    }) => models.initModel<RemoteProject>(
          models.project.type,
          {
            _id: prj.id,
            remoteId: prj.id,
            name: prj.name,
            parentId: organizationId,
          }
        )));

    await database.batchModifyDocs({ upsert: projectsToUpdate });

    if (!projectId || projectId === 'undefined') {
      projectId = remoteProjects[0].id;
    }
  } catch (err) {
    console.log(err);
    throw redirect('/organization');
  }

  const projectWorkspaces = await models.workspace.findByParentId(projectId);

  const getWorkspaceMetaData = async (workspace: Workspace): Promise<WorkspaceWithMetadata> => {
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
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    invariant(workspaceMeta, 'WorkspaceMeta was not found');
    const lastActiveBranch = workspaceMeta?.cachedGitRepositoryBranch;

    const lastCommitAuthor = workspaceMeta?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = isDesign(workspace)
      ? (apiSpec?.modified || 0)
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
    const name = isDesign(workspace) ? (apiSpec?.fileName || '') : workspace.name;
    const clientCertificates = await models.clientCertificate.findByParentId(workspace._id);

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
      name,
      apiSpec,
      specFormatVersion,
      workspaceMeta,
      clientCertificates,
      caCertificate: await models.caCertificate.findByParentId(workspace._id),
      workspace: {
        ...workspace,
        name,
      },
    };
  };

  // Fetch all workspace meta data in parallel
  const workspacesWithMetaData = await Promise.all(
    projectWorkspaces.map(getWorkspaceMetaData)
  );

  const workspaces = workspacesWithMetaData
    .filter(w => (scope !== 'all' ? w.workspace.scope === scope : true))
  // @TODO - Figure out if the database has a way to sort/filter items that could replace this logic.
    .filter(workspace => filter ? Boolean(fuzzyMatchAll(filter,
      // Use the filter string to match against these properties
      [
        workspace.name,
        workspace.workspace.scope === 'design' ? 'document' : 'collection',
        workspace.lastActiveBranch || '',
        workspace.specFormatVersion || '',
      ],
      { splitSpace: true, loose: true }
    )?.indexes) : true)
    .sort((a, b) => sortMethodMap[sortOrder as DashboardSortOrder](a, b));

  const allProjects = await models.project.all();
  const organizationProjects = allProjects.filter(proj => proj.parentId === organizationId);

  const projects = sortProjects(organizationProjects).filter(p =>
    p.name.toLowerCase().includes(projectName.toLowerCase())
  );

  return {
    workspaces,
    projects,
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
  } = useLoaderData() as ProjectLoaderData;
  const { organizationId } = useParams() as { organizationId: string };
  const [searchParams] = useSearchParams();
  const [isGitRepositoryCloneModalOpen, setIsGitRepositoryCloneModalOpen] =
    useState(false);

  const { presence } = usePresenceContext();

  const fetcher = useFetcher();
  const submit = useSubmit();
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

  const importFromGit = () => {
    setIsGitRepositoryCloneModalOpen(true);
  };

  const hasWorkspaces = workspaces?.length > 0;

  return (
    <ErrorBoundary>
      <Fragment>
        <SidebarLayout
          renderPageSidebar={
            <OrganizationProjectsSidebar
              organizationId={organizationId}
              title={'TODO'}
              projects={projects}
              workspaces={workspaces.map(w => w.workspace)}
              activeProject={activeProject}
              allFilesCount={allFilesCount}
              collectionsCount={collectionsCount}
              documentsCount={documentsCount}
              createNewCollection={createNewCollection}
              createNewDocument={createNewDocument}
            />
          }
          renderPaneOne={
            <Pane
              style={
                !hasWorkspaces
                  ? {
                    gridTemplateRows: 'auto 1fr',
                    gridTemplateColumns: '1fr',
                  }
                  : undefined
              }
            >
              <PaneHeaderToolbar>
                <SearchFormControl className="form-control form-control--outlined no-margin">
                  <SearchInput
                    autoFocus
                    type="text"
                    placeholder="Filter..."
                    onChange={event =>
                      submit({
                        ...Object.fromEntries(searchParams.entries()),
                        filter: event.target.value,
                      })
                    }
                    className="no-margin"
                  />
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      position: 'absolute',
                      right: 'var(--padding-sm)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                    className="fa fa-search"
                  />
                </SearchFormControl>
                <div style={{ display: 'flex' }}>
                  <DashboardSortDropdown
                    value={sortOrder}
                    onSelect={sortOrder => {
                      submit({
                        ...Object.fromEntries(searchParams.entries()),
                        sortOrder,
                      });
                    }}
                  />
                  {isRemoteProject(activeProject) && (
                    <RemoteWorkspacesDropdown
                      key={activeProject._id}
                      project={activeProject}
                    />
                  )}
                  <Dropdown
                    aria-label="Create New Dropdown"
                    triggerButton={
                      <StyledDropdownButton
                        disableHoverBehavior={false}
                        removePaddings={false}
                        size="medium"
                      >
                        <i className="fa fa-plus" /> Create{' '}
                        <i className="fa fa-caret-down pad-left-sm" />
                      </StyledDropdownButton>
                    }
                  >
                    <DropdownSection aria-label="New Section" title="New">
                      <DropdownItem aria-label="Request Collection">
                        <ItemContent
                          icon="bars"
                          label="Request Collection"
                          onClick={createNewCollection}
                        />
                      </DropdownItem>
                      <DropdownItem aria-label="Design Document">
                        <ItemContent
                          icon="file-o"
                          label="Design Document"
                          onClick={createNewDocument}
                        />
                      </DropdownItem>
                    </DropdownSection>
                    <DropdownSection
                      aria-label="Import From"
                      title="Import"
                    >
                      <DropdownItem aria-label="Import">
                        <ItemContent
                          icon="file-import"
                          label="Import"
                          onClick={() => setImportModalType('file')}
                        />
                      </DropdownItem>
                      <DropdownItem aria-label="Git Clone">
                        <ItemContent
                          icon="code-fork"
                          label="Git Clone"
                          onClick={importFromGit}
                        />
                      </DropdownItem>
                    </DropdownSection>
                  </Dropdown>
                </div>
              </PaneHeaderToolbar>
              {hasWorkspaces &&
                workspaces.map(workspace => (
                  <WorkspaceCard
                    workspaceWithMetadata={workspace}
                    projects={projects}
                    key={workspace._id}
                    activeProject={activeProject}
                    activeUsers={presence.filter(p => {
                      return (
                        p.project === activeProject._id &&
                        p.file === workspace.workspace._id
                      );
                    })}
                    onSelect={() =>
                      navigate(
                        `/organization/${organizationId}/project/${
                          activeProject._id
                        }/workspace/${workspace.workspace._id}/${
                          workspace.workspace.scope === 'design'
                            ? ACTIVITY_SPEC
                            : ACTIVITY_DEBUG
                        }`
                      )
                    }
                    filter={filter}
                  />
                ))}
              {filter && !hasWorkspaces && (
                <div>
                  <p className="notice subtle">
                    No documents found for <strong>{filter}</strong>
                  </p>
                </div>
              )}
              {!filter && !hasWorkspaces && (
                <EmptyStatePane
                  createRequestCollection={createNewCollection}
                  createDesignDocument={createNewDocument}
                  importFrom={() => setImportModalType('file')}
                  cloneFromGit={importFromGit}
                />
              )}
            </Pane>
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

const ListContent = styled.ul({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  width: '100%',
});

const List = <T extends object>(
  props: ListProps<T> & AriaGridListOptions<T>
) => {
  const state = useListState(props);
  const ref = useRef(null);
  const { gridProps } = useGridList(props, state, ref);

  return (
    <ListContent {...gridProps} ref={ref}>
      {[...state.collection].map(item => (
        <ListItem key={item.key} item={item} state={state} />
      ))}
    </ListContent>
  );
};

const ListItemContent = styled.li<{
  isSelected: boolean;
  nestingLevel?: number;
}>(props => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'nowrap',
  width: '100%',
  outline: 'none',
  padding: 0,
  gap: 'var(--padding-sm)',
  color: props.isSelected ? 'var(--color-font)' : 'var(--hl)',
  backgroundColor: props.isSelected ? 'var(--hl-xs)' : undefined,
  boxSizing: 'border-box',
  '&:hover': {
    backgroundColor: 'var(--hl-xs)',
  },
}));

interface ItemProps<T extends object> {
  item: AriaGridListItemOptions['node'];
  state: ListState<T>;
}

const ListItem = <T extends object>({ item, state }: ItemProps<T>) => {
  const ref = React.useRef(null);
  const { rowProps, gridCellProps } = useGridListItem(
    { node: item },
    state,
    ref
  );

  const { focusProps } = useFocusRing();
  const isSelected = state.selectionManager.selectedKeys.has(item.key);

  return (
    <ListItemContent
      nestingLevel={item.level}
      isSelected={isSelected}
      {...mergeProps(rowProps, focusProps)}
      ref={ref}
    >
      <div
        style={{
          width: '100%',
        }}
        {...gridCellProps}
      >
        {item.rendered}
      </div>
    </ListItemContent>
  );
};

export default ProjectRoute;
