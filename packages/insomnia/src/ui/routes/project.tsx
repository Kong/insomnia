import { invariant } from '@remix-run/router';
import React, { FC, Fragment, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  LoaderFunction,
  useFetcher,
  useLoaderData,
  useNavigate,
  useRevalidator,
  useSearchParams,
  useSubmit,
} from 'react-router-dom';
import styled from 'styled-components';

import { isLoggedIn } from '../../account/session';
import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  DashboardSortOrder,
} from '../../common/constants';
import { database } from '../../common/database';
import { fuzzyMatchAll, isNotNullOrUndefined } from '../../common/misc';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import * as models from '../../models';
import { ApiSpec } from '../../models/api-spec';
import { sortProjects } from '../../models/helpers/project';
import { isRemoteProject, Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { MemClient } from '../../sync/git/mem-client';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { getVCS } from '../../sync/vcs/vcs';
import { AppHeader } from '../components/app-header';
import { Dropdown } from '../components/base/dropdown/dropdown';
import { DropdownButton } from '../components/base/dropdown/dropdown-button';
import { DropdownDivider } from '../components/base/dropdown/dropdown-divider';
import { DropdownItem } from '../components/base/dropdown/dropdown-item';
import { DashboardSortDropdown } from '../components/dropdowns/dashboard-sort-dropdown';
import { ProjectDropdown } from '../components/dropdowns/project-dropdown';
import { RemoteWorkspacesDropdown } from '../components/dropdowns/remote-workspaces-dropdown';
import { showPrompt } from '../components/modals';
import { PageLayout } from '../components/page-layout';
import { WrapperHomeEmptyStatePane } from '../components/panes/wrapper-home-empty-state-pane';
import { SvgIcon } from '../components/svg-icon';
import { Button } from '../components/themed-button';
import { WorkspaceCard } from '../components/workspace-card';
import { cloneGitRepository } from '../redux/modules/git';
import { selectIsLoading } from '../redux/modules/global';
import { ForceToWorkspace } from '../redux/modules/helpers';
import {
  importClipBoard,
  importFile,
  importUri,
} from '../redux/modules/import';

const CreateButton = styled(Button).attrs({
  variant: 'contained',
  bg: 'surprise',
})({
  '&&': {
    marginLeft: 'var(--padding-md)',
  },
});

const CardContainer = styled.div({
  display: 'flex',
  flexWrap: 'wrap',
  paddingTop: 'var(--padding-md)',
});

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

interface LoaderData {
  workspaces: WorkspaceWithMetadata[];
  activeProject: Project;
  projects: Project[];
}

export const loader: LoaderFunction = async ({
  params,
  request,
}): Promise<LoaderData> => {
  const search = new URL(request.url).searchParams;
  const { projectId } = params;
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

  // Load all projects
  try {
    const vcs = getVCS();
    if (vcs && isLoggedIn()) {
      const teams = await vcs.teams();
      const projects = await Promise.all(teams.map(initializeProjectFromTeam));
      await database.batchModifyDocs({ upsert: projects });
    }
  } catch {
    console.log('Failed to load projects');
  }

  const projects = sortProjects(await models.project.all());

  return {
    workspaces,
    projects,
    activeProject: project,
  };
};

const ProjectRoute: FC = () => {
  const { workspaces, activeProject, projects } = useLoaderData() as LoaderData;
  const [searchParams] = useSearchParams();
  const isLoading = useSelector(selectIsLoading);
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
            action: `project/${activeProject._id}/workspace/new`,
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
            action: `project/${activeProject._id}/workspace/new`,
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
    dispatch(cloneGitRepository({ createFsClient: MemClient.createClient }));
  }, [dispatch]);

  return (
    <Fragment>
      <PageLayout
        renderPageHeader={
          <AppHeader
            breadcrumbProps={{
              crumbs: [
                {
                  id: 'project',
                  node: (
                    <ProjectDropdown
                      activeProject={activeProject}
                      projects={projects}
                    />
                  ),
                },
              ],
              isLoading,
            }}
          />
        }
        renderPageBody={
          <div className="document-listing theme--pane layout-body">
            <div className="document-listing__body pad-bottom">
              <div className="row-spaced margin-top margin-bottom-sm">
                <h2 className="no-margin">Dashboard</h2>
                <div className="row row--right pad-left wide">
                  <div
                    className="form-control form-control--outlined no-margin"
                    style={{
                      maxWidth: '400px',
                    }}
                  >
                    <input
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
                  </div>
                  <DashboardSortDropdown
                    value={sortOrder}
                    onSelect={sortOrder => {
                      submit({
                        sortOrder,
                        filter,
                      });
                    }}
                  />
                  {isRemoteProject(activeProject) && <RemoteWorkspacesDropdown project={activeProject} />}
                  <Dropdown>
                    <DropdownButton buttonClass={CreateButton}>
                      Create <i className="fa fa-caret-down pad-left-sm" />
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
                </div>
              </div>
              <CardContainer>
                {workspaces.map(workspace => (
                  <WorkspaceCard
                    {...workspace}
                    projects={projects}
                    key={workspace.apiSpec._id}
                    activeProject={activeProject}
                    onSelect={() =>
                      navigate(
                        `/project/${activeProject._id}/workspace/${
                          workspace.workspace._id
                        }/${
                          workspace.workspace.scope === 'design'
                            ? ACTIVITY_SPEC
                            : ACTIVITY_DEBUG
                        }`
                      )
                    }
                    filter={filter}
                  />
                ))}
              </CardContainer>
              {filter && workspaces.length === 0 && (
                <p className="notice subtle">
                  No documents found for <strong>{filter}</strong>
                </p>
              )}
              {!filter && !workspaces.length && (
                <WrapperHomeEmptyStatePane
                  createRequestCollection={createNewCollection}
                  createDesignDocument={createNewDocument}
                  importFromFile={importFromFile}
                  importFromURL={importFromURL}
                  importFromClipboard={importFromClipboard}
                  importFromGit={importFromGit}
                />
              )}
            </div>
            <div className="document-listing__footer vertically-center">
              <a className="made-with-love" href="https://konghq.com/">
                Made with&nbsp;
                <SvgIcon icon="heart" />
                &nbsp;by Kong
              </a>
            </div>
          </div>
        }
      />
    </Fragment>
  );
};

export default ProjectRoute;
