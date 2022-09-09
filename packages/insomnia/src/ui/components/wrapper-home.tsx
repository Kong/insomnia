import 'swagger-ui-react/swagger-ui.css';

import {
  Button,
  CardContainer,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  SvgIcon,
} from 'insomnia-components';
import React, { FC, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { unreachableCase } from 'ts-assert-unreachable';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import {
  DashboardSortOrder,
} from '../../common/constants';
import { hotKeyRefs } from '../../common/hotkeys';
import { executeHotKey } from '../../common/hotkeys-listener';
import { isNotNullOrUndefined } from '../../common/misc';
import { descendingNumberSort, sortMethodMap } from '../../common/sorting';
import { ApiSpec } from '../../models/api-spec';
import { isRemoteProject } from '../../models/project';
import { isDesign, Workspace, WorkspaceScopeKeys } from '../../models/workspace';
import { WorkspaceMeta } from '../../models/workspace-meta';
import { MemClient } from '../../sync/git/mem-client';
import { initializeLocalBackendProjectAndMarkForSync } from '../../sync/vcs/initialize-backend-project';
import { VCS } from '../../sync/vcs/vcs';
import { cloneGitRepository } from '../redux/modules/git';
import { selectIsLoading, setDashboardSortOrder } from '../redux/modules/global';
import { ForceToWorkspace } from '../redux/modules/helpers';
import { importClipBoard, importFile, importUri } from '../redux/modules/import';
import { activateWorkspace, createWorkspace } from '../redux/modules/workspace';
import { selectActiveProject, selectApiSpecs, selectDashboardSortOrder, selectIsLoggedIn, selectWorkspaceMetas, selectWorkspacesForActiveProject } from '../redux/selectors';
import { AppHeader } from './app-header';
import { DashboardSortDropdown } from './dropdowns/dashboard-sort-dropdown';
import { ProjectDropdown } from './dropdowns/project-dropdown';
import { RemoteWorkspacesDropdown } from './dropdowns/remote-workspaces-dropdown';
import { KeydownBinder } from './keydown-binder';
import { showPrompt } from './modals';
import { PageLayout } from './page-layout';
import { WrapperHomeEmptyStatePane } from './panes/wrapper-home-empty-state-pane';
import { WorkspaceCard, WorkspaceCardProps } from './workspace-card';

const CreateButton = styled(Button)({
  '&&': {
    marginLeft: 'var(--padding-md)',
  },
});

interface Props {
  vcs: VCS | null;
}

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

const WrapperHome: FC<Props> = (({ vcs }) => {
  const sortOrder = useSelector(selectDashboardSortOrder);
  const activeProject = useSelector(selectActiveProject);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isLoading = useSelector(selectIsLoading);
  const apiSpecs = useSelector(selectApiSpecs);
  const workspaceMetas = useSelector(selectWorkspaceMetas);
  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);

  const dispatch = useDispatch();

  const handleCreateWorkspace = useCallback(({ scope, onCreate }) => {
    dispatch(createWorkspace({ scope, onCreate }));
  }, [dispatch]);

  const handleGitCloneWorkspace = useCallback(({ createFsClient }) => {
    dispatch(cloneGitRepository({ createFsClient }));
  }, [dispatch]);

  const handleImportFile = useCallback(({ forceToWorkspace }) => {
    dispatch(importFile({ forceToWorkspace }));
  }, [dispatch]);

  const handleImportUri = useCallback((uri, { forceToWorkspace }) => {
    dispatch(importUri(uri, { forceToWorkspace }));
  }, [dispatch]);

  const handleImportClipboard = useCallback(({ forceToWorkspace }) => {
    dispatch(importClipBoard({ forceToWorkspace }));
  }, [dispatch]);

  const handleSetDashboardSortOrder = useCallback(sortOrder => {
    dispatch(setDashboardSortOrder(sortOrder));
  }, [dispatch]);

  const handleActivateWorkspace = useCallback(({ workspace }) => {
    dispatch(activateWorkspace({ workspace }));
  }, [dispatch]);

  const inputRef = useRef<HTMLInputElement>(null);
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
        onSelect={() => handleActivateWorkspace({ workspace: card.workspace })}
        filter={filter}
      />
    ));

  const createRequestCollection = useCallback(() => {
    handleCreateWorkspace({
      scope: WorkspaceScopeKeys.collection,
      onCreate: async (workspace: Workspace) => {
        // Don't mark for sync if not logged in at the time of creation
        if (isLoggedIn && vcs && isRemoteProject(activeProject)) {
          await initializeLocalBackendProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace });
        }
      },
    });
  }, [activeProject, handleCreateWorkspace, isLoggedIn, vcs]);

  const createDesignDocument = useCallback(() => {
    handleCreateWorkspace({ scope: WorkspaceScopeKeys.design });
  }, [handleCreateWorkspace]);

  const importFromURL = useCallback(() => {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        handleImportUri(uri, { forceToWorkspace: ForceToWorkspace.existing });
      },
    });
  }, [handleImportUri]);

  const importFromClipboard = useCallback(() => {
    handleImportClipboard({ forceToWorkspace: ForceToWorkspace.existing });
  }, [handleImportClipboard]);

  const importFromFile = useCallback(() => {
    handleImportFile({ forceToWorkspace: ForceToWorkspace.existing });
  }, [handleImportFile]);

  const importFromGit = useCallback(() => {
    handleGitCloneWorkspace({ createFsClient: MemClient.createClient });
  }, [handleGitCloneWorkspace]);

  const onChangeFilter = useCallback(event => {
    setFilter(event.currentTarget.value);
  }, []);

  const onKeydown = useCallback(event => {
    executeHotKey(event, hotKeyRefs.FILTER_DOCUMENTS, () => inputRef.current?.focus());
  }, []);

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
                  <KeydownBinder onKeydown={onKeydown}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Filter..."
                      onChange={onChangeFilter}
                      className="no-margin"
                    />
                    <span className="fa fa-search filter-icon" />
                  </KeydownBinder>
                </div>
                <DashboardSortDropdown value={sortOrder} onSelect={handleSetDashboardSortOrder} />
                <RemoteWorkspacesDropdown vcs={vcs} />
                <Dropdown
                  renderButton={<CreateButton variant="contained" bg="surprise">
                    Create <i className="fa fa-caret-down pad-left-sm" />
                  </CreateButton>}
                >
                  <DropdownDivider>New</DropdownDivider>
                  <DropdownItem
                    icon={<i className="fa fa-bars" />}
                    onClick={createRequestCollection}
                  >
                    Request Collection
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-file-o" />}
                    onClick={createDesignDocument}
                  >
                    Design Document
                  </DropdownItem>
                  <DropdownDivider>Import From</DropdownDivider>
                  <DropdownItem
                    icon={<i className="fa fa-plus" />}
                    onClick={importFromFile}
                  >
                    File
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-link" />}
                    onClick={importFromURL}
                  >
                    URL
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-clipboard" />}
                    onClick={importFromClipboard}
                  >
                    Clipboard
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-code-fork" />}
                    onClick={importFromGit}
                  >
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
