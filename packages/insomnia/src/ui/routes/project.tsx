import { invariant } from '@remix-run/router';
import React, { FC, Fragment, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  LoaderFunction,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
  useParams,
  useRevalidator,
  useSearchParams,
  useSubmit,
} from 'react-router-dom';
import styled from 'styled-components';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  DashboardSortOrder,
} from '../../common/constants';
import { fuzzyMatchAll, isNotNullOrUndefined } from '../../common/misc';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import { strings } from '../../common/strings';
import * as models from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { sortProjects } from '../../models/helpers/project';
import { DEFAULT_ORGANIZATION_ID, defaultOrganization, Organization } from '../../models/organization';
import { isDefaultProject, isRemoteProject, Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { MemClient } from '../../sync/git/mem-client';
import { Dropdown } from '../components/base/dropdown/dropdown';
import { DropdownButton } from '../components/base/dropdown/dropdown-button';
import { DropdownDivider } from '../components/base/dropdown/dropdown-divider';
import { DropdownItem } from '../components/base/dropdown/dropdown-item';
import { DashboardSortDropdown } from '../components/dropdowns/dashboard-sort-dropdown';
import { ProjectDropdown } from '../components/dropdowns/project-dropdown';
import { RemoteWorkspacesDropdown } from '../components/dropdowns/remote-workspaces-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { showAlert, showPrompt } from '../components/modals';
import { EmptyStatePane } from '../components/panes/project-empty-state-pane';
import { SidebarLayout } from '../components/sidebar-layout';
import { Button } from '../components/themed-button';
import { WorkspaceCard } from '../components/workspace-card';
import { cloneGitRepository } from '../redux/modules/git';
import { ForceToWorkspace } from '../redux/modules/helpers';
import {
  importClipBoard,
  importFile,
  importUri,
} from '../redux/modules/import';

const CreateButton = styled(Button).attrs({
  variant: 'outlined',
})({
  '&&': {
    marginLeft: 'var(--padding-md)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--padding-sm)',
    padding: '0 var(--padding-sm)',
  },
});

const CardsContainer = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
});

const SearchFormControl = styled.div({
  fontSize: 'var(--font-size-md)',
  maxWidth: '400px',
  minWidth: '200px',
});

const SearchInput = styled.input({
  margin: '0',
  width: '15rem',
});

const PaneHeaderTitle = styled.h2({
  margin: 0,
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  flex: 1,
});

const PaneHeaderToolbar = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flex: 1,
});

const PaneHeader = styled.div({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  margin: 0,
  boxSizing: 'border-box',
  gap: 'var(--padding-md)',
  padding: 'var(--padding-md)',
  backgroundColor: 'var(--color-bg)',
});

const PaneBody = styled.div({
  padding: 'var(--padding-md)',
  overflowY: 'auto',
  alignItems: 'center',
  flex: 1,
});

const Pane = styled.div({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--color-bg)',
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

const OrganizationProjectsSidebar: FC<{
  title: string;
  projects: Project[];
  activeProject: Project;
  organizationId: string;
}> = ({ activeProject, projects, title, organizationId }) => {
  const createNewProjectFetcher = useFetcher();
  const navigate = useNavigate();
  return (
    <Sidebar
      style={{
        height: '100%',
      }}
    >
      <SidebarTitle>
        {title}
      </SidebarTitle>
      <SidebarSection>
        <SidebarSectionTitle>
          Projects ({projects.length})
        </SidebarSectionTitle>
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
            if (activeProject.remoteId) {
              showAlert({
                title: 'This capability is coming soon',
                okLabel: 'Close',
                message: (
                  <div>
                    <p>
                      At the moment it is not possible to create more cloud
                      projects within a team in Insomnia.
                    </p>
                    <p>
                      🚀 This feature is coming soon!
                    </p>
                  </div>
                ),
              });
            } else {
              const defaultValue = `My ${strings.project.singular}`;
              showPrompt({
                title: `Create New ${strings.project.singular}`,
                submitName: 'Create',
                cancelable: true,
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
            }
          }}
        >
          <i data-testid="CreateProjectButton" className="fa fa-plus" />
        </Button>
      </SidebarSection>
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        {projects.map(proj => {
          return (
            <li key={proj._id} className="sidebar__row">
              <div
                className={`sidebar__item sidebar__item--request ${
                  activeProject._id === proj._id
                    ? 'sidebar__item--active'
                    : ''
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
                    navigate(
                      `/organization/${organizationId}/project/${proj._id}`
                    )
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
                {!isDefaultProject(proj) && (
                  <div
                    style={{
                      display: 'flex',
                      height: '100%',
                      alignItems: 'center',
                      padding: '0 var(--padding-md)',
                    }}
                  >
                    <ProjectDropdown organizationId={organizationId} project={proj} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Sidebar>
  );
};

interface WorkspaceWithMetadata {
  hasUnsavedChanges: boolean;
  lastModifiedTimestamp: number;
  modifiedLocally: number;
  lastCommitTime: number | null | undefined;
  lastCommitAuthor: string | null | undefined;
  lastActiveBranch: string | null | undefined;
  spec: Record<string, any> | null;
  specFormat: 'openapi' | 'swagger' | null;
  name: string;
  apiSpec: ApiSpec;
  specFormatVersion: string | null;
  workspace: Workspace;
}

export const indexLoader: LoaderFunction = async ({ params }) => {
  const { organizationId } = params;
  invariant(organizationId, 'Organization ID is required');

  if (models.organization.DEFAULT_ORGANIZATION_ID === organizationId) {
    const localProjects = (await models.project.all()).filter(proj => !isRemoteProject(proj));
    if (localProjects[0]._id) {
      return redirect(`/organization/${organizationId}/project/${localProjects[0]._id}`);
    }
  } else {
    const projectId = organizationId;
    return redirect(`/organization/${organizationId}/project/${projectId}`);
  }

  return;
};

interface LoaderData {
  workspaces: WorkspaceWithMetadata[];
  activeProject: Project;
  projects: Project[];
  organization: Organization;
}

export const loader: LoaderFunction = async ({
  params,
  request,
}): Promise<LoaderData> => {
  const search = new URL(request.url).searchParams;
  const { projectId, organizationId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'projectId parameter is required');

  const sortOrder = search.get('sortOrder') || 'modified-desc';
  const filter = search.get('filter') || '';

  const project = await models.project.getById(projectId);

  invariant(project, 'Project was not found');

  const projectWorkspaces = await models.workspace.findByParentId(project._id);

  const getWorkspaceMetaData = async (workspace: Workspace) => {
    const apiSpec = await models.apiSpec.getByParentId(workspace._id);
    invariant(apiSpec, 'ApiSpec should exist for workspace');

    let spec: ParsedApiSpec['contents'] = null;
    let specFormat: ParsedApiSpec['format'] = null;
    let specFormatVersion: ParsedApiSpec['formatVersion'] = null;

    try {
      const result = parseApiSpec(apiSpec.contents);
      spec = result.contents;
      specFormat = result.format;
      specFormatVersion = result.formatVersion;
    } catch (err) {
      // Assume there is no spec
      // TODO: Check for parse errors if it's an invalid spec
    }

    const workspaceMeta = await models.workspaceMeta.getByParentId(
      workspace._id
    );
    const lastActiveBranch = workspaceMeta?.cachedGitRepositoryBranch;

    const lastCommitAuthor = workspaceMeta?.cachedGitLastAuthor;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta?.modified || workspace.modified;

    const modifiedLocally = isDesign(workspace)
      ? apiSpec.modified
      : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      apiSpec.modified,
      workspaceMeta?.cachedGitLastCommitTime,
    ];

    const lastModifiedTimestamp = lastModifiedFrom
      .filter(isNotNullOrUndefined)
      .sort(descendingNumberSort)[0];

    const hasUnsavedChanges = Boolean(
      isDesign(workspace) &&
        workspaceMeta?.cachedGitLastCommitTime &&
        apiSpec.modified > workspaceMeta?.cachedGitLastCommitTime
    );

    return {
      hasUnsavedChanges,
      lastModifiedTimestamp,
      modifiedLocally,
      lastCommitTime: workspaceMeta?.cachedGitLastCommitTime,
      lastCommitAuthor,
      lastActiveBranch,
      spec,
      specFormat,
      name: isDesign(workspace) ? apiSpec.fileName : workspace.name,
      apiSpec,
      specFormatVersion,
      workspace,
    };
  };

  // @TODO - Figure out if the database has a way to sort/filter items that could replace this logic.
  const filterWorkspace = (workspace: WorkspaceWithMetadata) => {
    const matchResults = fuzzyMatchAll(
      // Use the filter string
      filter,
      // to match against these properties
      [
        workspace.name,
        workspace.workspace.scope === 'design' ? 'document' : 'collection',
        workspace.lastActiveBranch || '',
        workspace.specFormatVersion || '',
      ],
      {
        splitSpace: true,
        loose: true,
      }
    );

    return filter ? Boolean(matchResults?.indexes) : true;
  };

  function sortWorkspaces(
    workspaceWithMetaA: WorkspaceWithMetadata,
    workspaceWithMetaB: WorkspaceWithMetadata
  ) {
    switch (sortOrder) {
      case 'modified-desc':
        return sortMethodMap['modified-desc'](
          workspaceWithMetaA,
          workspaceWithMetaB
        );
      case 'name-asc':
        return sortMethodMap['name-asc'](
          workspaceWithMetaA.workspace,
          workspaceWithMetaB.workspace
        );
      case 'name-desc':
        return sortMethodMap['name-desc'](
          workspaceWithMetaA.workspace,
          workspaceWithMetaB.workspace
        );
      case 'created-asc':
        return sortMethodMap['created-asc'](
          workspaceWithMetaA.workspace,
          workspaceWithMetaB.workspace
        );
      case 'created-desc':
        return sortMethodMap['created-desc'](
          workspaceWithMetaA.workspace,
          workspaceWithMetaB.workspace
        );
      default:
        throw new Error(`Invalid sort order: ${sortOrder}`);
    }
  }

  // Fetch all workspace meta data in parallel
  const workspacesWithMetaData = await Promise.all(
    projectWorkspaces.map(getWorkspaceMetaData)
  );

  const workspaces = workspacesWithMetaData
    .filter(filterWorkspace)
    .sort(sortWorkspaces);

  const allProjects = await models.project.all();

  const organizationProjects = organizationId === DEFAULT_ORGANIZATION_ID ? allProjects.filter(proj => !isRemoteProject(proj)) : [project];

  const projects = sortProjects(organizationProjects);

  return {
    organization: organizationId === DEFAULT_ORGANIZATION_ID ? defaultOrganization : {
      _id: organizationId,
      name: projects[0].name,
    },
    workspaces,
    projects,
    activeProject: project,
  };
};

const ProjectRoute: FC = () => {
  const { workspaces, activeProject, projects, organization } = useLoaderData() as LoaderData;
  const { organizationId } = useParams() as {organizationId: string};
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const fetcher = useFetcher();
  const { revalidate } = useRevalidator();

  const submit = useSubmit();
  const navigate = useNavigate();
  const filter = searchParams.get('filter') || '';
  const sortOrder =
    (searchParams.get('sortOrder') as DashboardSortOrder) || 'modified-desc';

  const createNewCollection = () => {
    showPrompt({
      title: 'Create New Request Collection',
      submitName: 'Create',
      cancelable: true,
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
            action: `/organization/${organization._id}/project/${activeProject._id}/workspace/new`,
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
      cancelable: true,
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
            action: `/organization/${organization._id}/project/${activeProject._id}/workspace/new`,
            method: 'post',
          }
        );
      },
    });
  };

  const importFromURL = useCallback(() => {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      cancelable: true,
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        dispatch(
          importUri(uri, { forceToWorkspace: ForceToWorkspace.existing, onComplete: revalidate })
        );
      },
    });
  }, [dispatch, revalidate]);

  const importFromClipboard = useCallback(() => {
    dispatch(importClipBoard({ forceToWorkspace: ForceToWorkspace.existing, onComplete: revalidate }));
  }, [dispatch, revalidate]);

  const importFromFile = useCallback(() => {
    dispatch(importFile({ forceToWorkspace: ForceToWorkspace.existing, onComplete: revalidate }));
  }, [dispatch, revalidate]);

  const importFromGit = useCallback(() => {
    dispatch(cloneGitRepository({ createFsClient: MemClient.createClient, onComplete: revalidate }));
  }, [dispatch, revalidate]);

  const hasWorkspaces = workspaces?.length > 0;

  return (
    <ErrorBoundary>
      <Fragment>
        <SidebarLayout
          renderPageSidebar={
            <OrganizationProjectsSidebar
              organizationId={organizationId}
              title={organization.name}
              projects={projects}
              activeProject={activeProject}
            />
          }
          renderPaneOne={
            <Pane>
              <PaneHeader>
                <PaneHeaderTitle>All Files ({workspaces.length})</PaneHeaderTitle>
                <PaneHeaderToolbar>
                  <SearchFormControl className="form-control form-control--outlined no-margin">
                    <SearchInput
                      autoFocus
                      type="text"
                      placeholder="Filter..."
                      onChange={event =>
                        submit({
                          filter: event.target.value,
                          sortOrder,
                        })
                      }
                      className="no-margin"
                    />
                    <span className="fa fa-search filter-icon" />
                  </SearchFormControl>
                  <DashboardSortDropdown
                    value={sortOrder}
                    onSelect={sortOrder => {
                      submit({
                        sortOrder,
                        filter,
                      });
                    }}
                  />
                  {isRemoteProject(activeProject) && (
                    <RemoteWorkspacesDropdown key={activeProject._id} project={activeProject} />
                  )}
                  <Dropdown>
                    <DropdownButton buttonClass={CreateButton}>
                      <i className="fa fa-plus" />Create <i className="fa fa-caret-down pad-left-sm" />
                    </DropdownButton>
                    <DropdownDivider>New</DropdownDivider>
                    <DropdownItem onClick={createNewCollection}>
                      <i className="fa fa-bars" />
                      Request Collection
                    </DropdownItem>
                    <DropdownItem onClick={createNewDocument}>
                      <i className="fa fa-file-o" />
                      Design Document
                    </DropdownItem>
                    <DropdownDivider>Import From</DropdownDivider>
                    <DropdownItem onClick={importFromFile}>
                      <i className="fa fa-plus" />
                      File
                    </DropdownItem>
                    <DropdownItem onClick={importFromURL}>
                      <i className="fa fa-link" />
                      URL
                    </DropdownItem>
                    <DropdownItem onClick={importFromClipboard}>
                      <i className="fa fa-clipboard" />
                      Clipboard
                    </DropdownItem>
                    <DropdownItem onClick={importFromGit}>
                      <i className="fa fa-code-fork" />
                      Git Clone
                    </DropdownItem>
                  </Dropdown>
                </PaneHeaderToolbar>
              </PaneHeader>
              <PaneBody>
                {hasWorkspaces && (
                  <CardsContainer>
                    {workspaces.map(workspace => (
                      <WorkspaceCard
                        {...workspace}
                        projects={projects}
                        key={workspace.apiSpec._id}
                        activeProject={activeProject}
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
                  </CardsContainer>
                )}
                {filter && !hasWorkspaces && (
                  <p className="notice subtle">
                    No documents found for <strong>{filter}</strong>
                  </p>
                )}
                {!filter && !hasWorkspaces && (
                  <EmptyStatePane
                    createRequestCollection={createNewCollection}
                    createDesignDocument={createNewDocument}
                    importFromFile={importFromFile}
                    importFromURL={importFromURL}
                    importFromClipboard={importFromClipboard}
                    importFromGit={importFromGit}
                  />
                )}
              </PaneBody>
            </Pane>
          }
        />
      </Fragment>
    </ErrorBoundary>
  );
};

export default ProjectRoute;
