import 'swagger-ui-react/swagger-ui.css';

import React, { FC, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { unreachableCase } from 'ts-assert-unreachable';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  DashboardSortOrder,
} from '../../common/constants';
import { isNotNullOrUndefined } from '../../common/misc';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import { ApiSpec } from '../../models/api-spec';
import { isRemoteProject } from '../../models/project';
import { isDesign, Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { MemClient } from '../../sync/git/mem-client';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
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
import { WorkspaceCard, WorkspaceCardProps } from '../components/workspace-card';
import { useVCS } from '../hooks/use-vcs';
import { cloneGitRepository } from '../redux/modules/git';
import { selectIsLoading, setDashboardSortOrder } from '../redux/modules/global';
import { ForceToWorkspace } from '../redux/modules/helpers';
import { importClipBoard, importFile, importUri } from '../redux/modules/import';
import { activateWorkspace, createWorkspace } from '../redux/modules/workspace';
import { selectActiveProject, selectApiSpecs, selectDashboardSortOrder, selectIsLoggedIn, selectWorkspaceMetas, selectWorkspacesForActiveProject } from '../redux/selectors';

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

function orderDashboardCards(orderBy: DashboardSortOrder) {
  return (cardA: Pick<WorkspaceCardProps, 'workspace' | 'lastModifiedTimestamp'>, cardB: Pick<WorkspaceCardProps, 'workspace' | 'lastModifiedTimestamp'>) => {
    switch (orderBy) {
      case 'modified-desc':
        return sortMethodMap['modified-desc'](cardA, cardB);
      case 'name-asc':
        return sortMethodMap['name-asc'](cardA.workspace, cardB.workspace);
      case 'name-desc':
        return sortMethodMap['name-desc'](cardA.workspace, cardB.workspace);
      case 'created-asc':
        return sortMethodMap['created-asc'](cardA.workspace, cardB.workspace);
      case 'created-desc':
        return sortMethodMap['created-desc'](cardA.workspace, cardB.workspace);
      default:
        return unreachableCase(orderBy, `Dashboard ordering "${orderBy}" is invalid`);
    }
  };
}

const mapWorkspaceToWorkspaceCard = ({
  apiSpecs,
  workspaceMetas,
}: {
  apiSpecs: ApiSpec[];
  workspaceMetas: WorkspaceMeta[];
}) => (workspace: Workspace) => {
  const apiSpec = apiSpecs.find(s => s.parentId === workspace._id);

  // an apiSpec model will always exist because a migration in the workspace forces it to
  if (!apiSpec) {
    return null;
  }

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

  // Get cached branch from WorkspaceMeta
  const workspaceMeta = workspaceMetas?.find(({ parentId }) => parentId === workspace._id);

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
    isDesign(workspace) && workspaceMeta?.cachedGitLastCommitTime && apiSpec.modified > workspaceMeta?.cachedGitLastCommitTime
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
    apiSpec,
    specFormatVersion,
    workspace,
  };
};

const WrapperHome: FC = (() => {
  const sortOrder = useSelector(selectDashboardSortOrder);
  const activeProject = useSelector(selectActiveProject);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isLoading = useSelector(selectIsLoading);
  const apiSpecs = useSelector(selectApiSpecs);
  const workspaceMetas = useSelector(selectWorkspaceMetas);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const vcs = useVCS({});
  const dispatch = useDispatch();

  const [filter, setFilter] = useState('');

  // Render each card, removing all the ones that don't match the filter
  const cards = workspacesForActiveProject
    .map(mapWorkspaceToWorkspaceCard({ workspaceMetas, apiSpecs }))
    .filter(isNotNullOrUndefined)
    .sort(orderDashboardCards(sortOrder))
    .map(card => (
      <WorkspaceCard
        {...card}
        key={card.apiSpec._id}
        activeProject={activeProject}
        onSelect={() => dispatch(activateWorkspace({ workspace: card.workspace }))}
        filter={filter}
      />
    ));

  const createRequestCollection = useCallback(() => {
    dispatch(createWorkspace({
      scope: WorkspaceScopeKeys.collection,
      onCreate: async (workspace: Workspace) => {
        // Don't mark for sync if not logged in at the time of creation
        if (isLoggedIn && vcs && isRemoteProject(activeProject)) {
          await initializeLocalBackendProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace });
        }
      },
    }));
  }, [activeProject, dispatch, isLoggedIn, vcs]);

  const createDesignDocument = useCallback(() => {
    dispatch(createWorkspace({ scope: WorkspaceScopeKeys.design  }));
  }, [dispatch]);

  const importFromURL = useCallback(() => {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        dispatch(importUri(uri, { forceToWorkspace: ForceToWorkspace.existing }));
      },
    });
  }, [dispatch]);

  const importFromClipboard = useCallback(() => {
    dispatch(importClipBoard({ forceToWorkspace: ForceToWorkspace.existing }));
  }, [dispatch]);

  const importFromFile = useCallback(() => {
    dispatch(importFile({ forceToWorkspace: ForceToWorkspace.existing }));
  }, [dispatch]);

  const importFromGit = useCallback(() => {
    dispatch(cloneGitRepository({ createFsClient: MemClient.createClient }));
  }, [dispatch]);

  return (
    <PageLayout
      renderPageHeader={
        <AppHeader
          breadcrumbProps={{
            crumbs: [
              {
                id: 'project',
                node: <ProjectDropdown vcs={vcs || undefined} />,
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
                    onChange={event => {
                      setFilter(event.currentTarget.value);
                    }}
                    className="no-margin"
                  />
                  <span className="fa fa-search filter-icon" />
                </div>
                <DashboardSortDropdown
                  value={sortOrder}
                  onSelect={sortOrder => {
                    dispatch(setDashboardSortOrder(sortOrder));
                  }}
                />
                <RemoteWorkspacesDropdown vcs={vcs} />
                <Dropdown>
                  <DropdownButton buttonClass={CreateButton}>
                    Create <i className="fa fa-caret-down pad-left-sm" />
                  </DropdownButton>
                  <DropdownDivider>New</DropdownDivider>
                  <DropdownItem
                    onClick={createRequestCollection}
                  >
                    <i className="fa fa-bars" />
                    Request Collection
                  </DropdownItem>
                  <DropdownItem
                    onClick={createDesignDocument}
                  >
                    <i className="fa fa-file-o" />
                    Design Document
                  </DropdownItem>
                  <DropdownDivider>Import From</DropdownDivider>
                  <DropdownItem
                    onClick={importFromFile}
                  >
                    <i className="fa fa-plus" />
                    File
                  </DropdownItem>
                  <DropdownItem
                    onClick={importFromURL}
                  >
                    <i className="fa fa-link" />
                    URL
                  </DropdownItem>
                  <DropdownItem
                    onClick={importFromClipboard}
                  >
                    <i className="fa fa-clipboard" />
                    Clipboard
                  </DropdownItem>
                  <DropdownItem
                    onClick={importFromGit}
                  >
                    <i className="fa fa-code-fork" />
                    Git Clone
                  </DropdownItem>
                </Dropdown>
              </div>
            </div>
            <CardContainer>{cards}</CardContainer>
            {filter && cards.length === 0 && (
              <p className="notice subtle">
                No documents found for <strong>{filter}</strong>
              </p>
            )}
            {!filter && !cards.length && (
              <WrapperHomeEmptyStatePane
                createRequestCollection={createRequestCollection}
                createDesignDocument={createDesignDocument}
                importFromFile={importFromFile}
                importFromURL={importFromURL}
                importFromClipboard={importFromClipboard}
                importFromGit={importFromGit}
              />
            )}
          </div>
          <div className="document-listing__footer vertically-center">
            <a className="made-with-love" href="https://konghq.com/">
              Made with&nbsp;<SvgIcon icon="heart" />&nbsp;by Kong
            </a>
          </div>
        </div>
      }
    />
  );
});

export default WrapperHome;
