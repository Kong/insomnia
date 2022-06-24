import 'swagger-ui-react/swagger-ui.css';

import {
  Button,
  CardContainer,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  SvgIcon,
} from 'insomnia-components';
import React, { useRef, useState } from 'react';
import { connect } from 'react-redux';
import { AnyAction, bindActionCreators, Dispatch } from 'redux';
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
import { RootState } from '../redux/modules';
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
import { Notice } from './notice';
import { PageLayout } from './page-layout';
import { WorkspaceCard, WorkspaceCardProps } from './workspace-card';
import type { WrapperProps } from './wrapper';

const CreateButton = styled(Button)({
  '&&': {
    marginLeft: 'var(--padding-md)',
  },
});

interface Props extends ReturnType<typeof mapDispatchToProps>,
ReturnType<typeof mapStateToProps> {
  wrapperProps: WrapperProps;
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
  const workspaceMeta = workspaceMetas?.find(
    wm => wm.parentId === workspace._id
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

const WrapperHome: React.FC<Props> = (({
  activeProject,
  isLoading,
  isLoggedIn,
  sortOrder,
  handleSetDashboardSortOrder,
  wrapperProps,
  apiSpecs,
  workspacesForActiveProject,
  handleActivateWorkspace,
  workspaceMetas,
  handleGitCloneWorkspace,
  handleImportClipboard,
  handleImportUri,
  handleCreateWorkspace,
  handleImportFile,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState('');

  const { vcs } = wrapperProps;
  // Render each card, removing all the ones that don't match the filter
  const cards = workspacesForActiveProject
    .map(mapWorkspaceToWorkspaceCard({ workspaceMetas, apiSpecs }))
    .filter(isNotNullOrUndefined)
    .sort(orderDashboardCards(sortOrder))
    .map(props => (
      <WorkspaceCard
        {...props}
        key={props.apiSpec._id}
        activeProject={activeProject}
        onSelect={() => handleActivateWorkspace({ workspace: props.workspace })}
        filter={filter}
      />
    ));

  return (
    <PageLayout
      wrapperProps={wrapperProps}
      renderPageHeader={() => (
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
      )}
      renderPageBody={() => (
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
                  <KeydownBinder onKeydown={event => executeHotKey(event, hotKeyRefs.FILTER_DOCUMENTS, () => inputRef.current?.focus())}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Filter..."
                      onChange={event => setFilter(event.currentTarget.value)}
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
                    icon={<i className="fa fa-file-o" />}
                    onClick={() => handleCreateWorkspace({ scope: WorkspaceScopeKeys.design })}
                  >
                    Design Document
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-bars" />}
                    onClick={() => handleCreateWorkspace({
                      scope: WorkspaceScopeKeys.collection,
                      onCreate: async workspace => {
                        // Don't mark for sync if not logged in at the time of creation
                        if (isLoggedIn && vcs && isRemoteProject(activeProject)) {
                          await initializeLocalBackendProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace });
                        }
                      },
                    })}
                  >
                    Request Collection
                  </DropdownItem>
                  <DropdownDivider>Import From</DropdownDivider>
                  <DropdownItem
                    icon={<i className="fa fa-plus" />}
                    onClick={() => handleImportFile({ forceToWorkspace: ForceToWorkspace.existing })}
                  >
                    File
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-link" />}
                    onClick={() => showPrompt({
                      title: 'Import document from URL',
                      submitName: 'Fetch and Import',
                      label: 'URL',
                      placeholder: 'https://website.com/insomnia-import.json',
                      onComplete: uri => {
                        handleImportUri(uri, { forceToWorkspace: ForceToWorkspace.existing });
                      },
                    })}
                  >
                    URL
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-clipboard" />}
                    onClick={() => handleImportClipboard({ forceToWorkspace: ForceToWorkspace.existing })}
                  >
                    Clipboard
                  </DropdownItem>
                  <DropdownItem
                    icon={<i className="fa fa-code-fork" />}
                    onClick={() => handleGitCloneWorkspace({ createFsClient: MemClient.createClient })}
                  >
                    Git Clone
                  </DropdownItem>
                </Dropdown>
              </div>
            </div>
            <CardContainer>{cards}</CardContainer>
            {filter && cards.length === 0 && (
              <Notice color="subtle">
                No documents found for <strong>{filter}</strong>
              </Notice>
            )}
          </div>
          <div className="document-listing__footer vertically-center">
            <a className="made-with-love" href="https://github.com/Kong/insomnia">
              Made with&nbsp;<SvgIcon icon="heart" />&nbsp;by Kong
            </a>
          </div>
        </div>
      )}
    />
  );
});

const mapStateToProps = (state: RootState) => ({
  sortOrder: selectDashboardSortOrder(state),
  activeProject: selectActiveProject(state),
  isLoggedIn: selectIsLoggedIn(state),
  isLoading: selectIsLoading(state),
  apiSpecs: selectApiSpecs(state),
  workspaceMetas: selectWorkspaceMetas(state),
  workspacesForActiveProject: selectWorkspacesForActiveProject(state),
});

const mapDispatchToProps = (dispatch: Dispatch<AnyAction>) => {
  const bound = bindActionCreators(
    {
      createWorkspace,
      cloneGitRepository,
      importFile,
      importClipBoard,
      importUri,
      setDashboardSortOrder,
      activateWorkspace,
    },
    dispatch
  );

  return ({
    handleCreateWorkspace: bound.createWorkspace,
    handleGitCloneWorkspace: bound.cloneGitRepository,
    handleImportFile: bound.importFile,
    handleImportUri: bound.importUri,
    handleImportClipboard: bound.importClipBoard,
    handleSetDashboardSortOrder: bound.setDashboardSortOrder,
    handleActivateWorkspace: bound.activateWorkspace,
  });
};

export default connect(mapStateToProps, mapDispatchToProps)(WrapperHome);
