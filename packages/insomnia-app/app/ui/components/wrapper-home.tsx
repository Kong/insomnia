import React, { Fragment, PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import {
  GlobalActivity,
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  AUTOBIND_CFG,
  isWorkspaceActivity,
} from '../../common/constants';
import { isDesign, Workspace, WorkspaceScopeKeys } from '../../models/workspace';

import 'swagger-ui-react/swagger-ui.css';
import {
  Breadcrumb,
  Button,
  Card,
  CardContainer,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Header,
} from 'insomnia-components';
import { WorkspaceCardDropdown } from './dropdowns/workspace-card-dropdown';
import KeydownBinder from './keydown-binder';
import { executeHotKey } from '../../common/hotkeys-listener';
import { hotKeyRefs } from '../../common/hotkeys';
import { showPrompt } from './modals';
import * as models from '../../models';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';
import { fuzzyMatchAll, isNotNullOrUndefined } from '../../common/misc';
import type {
  WrapperProps,
} from './wrapper';
import Notice from './notice';
import PageLayout from './page-layout';
import coreLogo from '../images/insomnia-core-logo.png';
import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import { RemoteWorkspacesDropdown } from './dropdowns/remote-workspaces-dropdown';
import SettingsButton from './buttons/settings-button';
import AccountDropdown from './dropdowns/account-dropdown';
import { strings } from '../../common/strings';
import { descendingNumberSort } from '../../common/sorting';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { createWorkspace } from '../redux/modules/workspace';
import { cloneGitRepository } from '../redux/modules/git';
import { MemClient } from '../../sync/git/mem-client';
import { SpaceDropdown } from './dropdowns/space-dropdown';
import { initializeLocalProjectAndMarkForSync } from '../../sync/vcs/initialize-project';
import { importClipBoard, importFile, importUri } from '../redux/modules/import';
import { ForceToWorkspace } from '../redux/modules/helpers';

interface RenderedCard {
  card: ReactNode;
  lastModifiedTimestamp?: number | null;
}

interface Props extends ReturnType<typeof mapDispatchToProps> {
  wrapperProps: WrapperProps;
}

interface State {
  filter: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperHome extends PureComponent<Props, State> {
  state: State = {
    filter: '',
  };

  _filterInput: HTMLInputElement | null = null;

  _setFilterInputRef(n: HTMLInputElement) {
    this._filterInput = n;
  }

  _handleFilterChange(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      filter: e.currentTarget.value,
    });
  }

  _handleDocumentCreate() {
    this.props.handleCreateWorkspace({
      scope: WorkspaceScopeKeys.design,
    });
  }

  _handleCollectionCreate() {
    const { handleCreateWorkspace, wrapperProps: { activeSpace, vcs, isLoggedIn } } = this.props;

    handleCreateWorkspace({
      scope: WorkspaceScopeKeys.collection,
      onCreate: async workspace => {
        const spaceRemoteId = activeSpace?.remoteId;

        // Don't mark for sync if not logged in at the time of creation
        if (isLoggedIn && vcs && spaceRemoteId) {
          await initializeLocalProjectAndMarkForSync({ vcs: vcs.newInstance(), workspace });
        }
      },
    });
  }

  _handleImportFile() {
    this.props.handleImportFile({
      forceToWorkspace: ForceToWorkspace.new,
    });
  }

  _handleImportClipBoard() {
    this.props.handleImportClipboard({
      forceToWorkspace: ForceToWorkspace.new,
    });
  }

  _handleImportUri() {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri, {
          forceToWorkspace: ForceToWorkspace.new,
        });
      },
    });
  }

  _handleWorkspaceClone() {
    this.props.handleGitCloneWorkspace({
      createFsClient: MemClient.createClient,
    });
  }

  _handleKeyDown(e) {
    executeHotKey(e, hotKeyRefs.FILTER_DOCUMENTS, () => {
      if (this._filterInput) {
        this._filterInput.focus();
      }
    });
  }

  async _handleClickCard(id: string, defaultActivity: GlobalActivity) {
    const { handleSetActiveWorkspace, handleSetActiveActivity } = this.props.wrapperProps;
    const { activeActivity } = await models.workspaceMeta.getOrCreateByParentId(id);

    if (!activeActivity || !isWorkspaceActivity(activeActivity)) {
      handleSetActiveActivity(defaultActivity);
    } else {
      handleSetActiveActivity(activeActivity);
    }

    handleSetActiveWorkspace(id);
  }

  renderCard(workspace: Workspace) {
    const {
      apiSpecs,
      workspaceMetas,
    } = this.props.wrapperProps;
    const { filter } = this.state;
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
    const workspaceMeta = workspaceMetas?.find(wm => wm.parentId === workspace._id);
    const lastActiveBranch = workspaceMeta ? workspaceMeta.cachedGitRepositoryBranch : null;
    const lastCommitAuthor = workspaceMeta ? workspaceMeta.cachedGitLastAuthor : null;
    const lastCommitTime = workspaceMeta ? workspaceMeta.cachedGitLastCommitTime : null;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta ? workspaceMeta.modified : workspace.modified;
    const modifiedLocally = isDesign(workspace) ? apiSpec.modified : workspaceModified;

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
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    let log = <TimeFromNow timestamp={lastModifiedTimestamp} />;
    let branch = lastActiveBranch;

    if (
      isDesign(workspace) &&
      lastCommitTime &&
      apiSpec.modified > lastCommitTime
    ) {
      // Show locally unsaved changes for spec
      // NOTE: this doesn't work for non-spec workspaces
      branch = lastActiveBranch + '*';
      log = (
        <Fragment>
          <TimeFromNow className="text-danger" timestamp={modifiedLocally} /> (unsaved)
        </Fragment>
      );
    } else if (lastCommitTime) {
      // Show last commit time and author
      branch = lastActiveBranch;
      log = (
        <Fragment>
          <TimeFromNow timestamp={lastCommitTime} /> {lastCommitAuthor && `by ${lastCommitAuthor}`}
        </Fragment>
      );
    }

    const docMenu = <WorkspaceCardDropdown apiSpec={apiSpec} workspace={workspace} />;
    const version = spec?.info?.version || '';
    let label: string = strings.collection.singular;
    let format = '';
    let labelIcon = <i className="fa fa-bars" />;
    let defaultActivity = ACTIVITY_DEBUG;
    let title = workspace.name;

    if (isDesign(workspace)) {
      label = strings.document.singular;
      labelIcon = <i className="fa fa-file-o" />;

      if (specFormat === 'openapi') {
        format = `OpenAPI ${specFormatVersion}`;
      } else if (specFormat === 'swagger') {
        // NOTE: This is not a typo, we're labeling Swagger as OpenAPI also
        format = `OpenAPI ${specFormatVersion}`;
      }

      defaultActivity = ACTIVITY_SPEC;
      title = apiSpec.fileName || title;
    }

    // Filter the card by multiple different properties
    const matchResults = fuzzyMatchAll(filter, [title, label, branch, version], {
      splitSpace: true,
      loose: true,
    });

    // Return null if we don't match the filter
    if (filter && !matchResults) {
      return null;
    }

    const card = (
      <Card
        key={apiSpec._id}
        docBranch={branch ? <Highlight search={filter} text={branch} /> : undefined}
        docTitle={title ? <Highlight search={filter} text={title} /> : undefined}
        docVersion={version ? <Highlight search={filter} text={`v${version}`} /> : undefined}
        tagLabel={
          label ? (
            <>
              <span className="margin-right-xs">{labelIcon}</span>
              <Highlight search={filter} text={label} />
            </>
          ) : undefined
        }
        docLog={log}
        docMenu={docMenu}
        docFormat={format}
        onClick={() => this._handleClickCard(workspace._id, defaultActivity)}
      />
    );
    const renderedCard: RenderedCard = {
      card,
      lastModifiedTimestamp,
    };
    return renderedCard;
  }

  renderCreateMenu() {
    const button = (
      <Button variant="contained" bg="surprise" className="margin-left">
        Create
        <i className="fa fa-caret-down pad-left-sm" />
      </Button>
    );
    return (
      <Dropdown renderButton={button}>
        <DropdownDivider>New</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-file-o" />} onClick={this._handleDocumentCreate}>
          Design Document
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-bars" />} onClick={this._handleCollectionCreate}>
          Request Collection
        </DropdownItem>
        <DropdownDivider>Import From</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-plus" />} onClick={this._handleImportFile}>
          File
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-link" />} onClick={this._handleImportUri}>
          URL
        </DropdownItem>
        <DropdownItem
          icon={<i className="fa fa-clipboard" />}
          onClick={this._handleImportClipBoard}>
          Clipboard
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-code-fork" />} onClick={this._handleWorkspaceClone}>
          Git Clone
        </DropdownItem>
      </Dropdown>
    );
  }

  renderDashboardMenu() {
    const { vcs } = this.props.wrapperProps;
    return (
      <div className="row row--right pad-left wide">
        <div
          className="form-control form-control--outlined no-margin"
          style={{
            maxWidth: '400px',
          }}>
          <KeydownBinder onKeydown={this._handleKeyDown}>
            <input
              ref={this._setFilterInputRef}
              type="text"
              placeholder="Filter..."
              onChange={this._handleFilterChange}
              className="no-margin"
            />
            <span className="fa fa-search filter-icon" />
          </KeydownBinder>
        </div>
        <RemoteWorkspacesDropdown vcs={vcs} className="margin-left" />
        {this.renderCreateMenu()}
      </div>
    );
  }

  render() {
    const { workspaces, isLoading, vcs } = this.props.wrapperProps;
    const { filter } = this.state;
    // Render each card, removing all the ones that don't match the filter
    const cards = workspaces
      .map(this.renderCard)
      .filter(isNotNullOrUndefined)
      // @ts-expect-error -- TSCONVERSION appears to be a genuine error
      .sort((a: RenderedCard, b: RenderedCard) => descendingNumberSort(a.lastModifiedTimestamp, b.lastModifiedTimestamp))
      .map(c => c?.card);
    const countLabel = cards.length === 1 ? strings.document.singular : strings.document.plural;
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header theme--app-header"
            gridLeft={
              <Fragment>
                <img src={coreLogo} alt="Insomnia" width="24" height="24" />
                <Breadcrumb crumbs={[{ id: 'space', node: <SpaceDropdown vcs={vcs || undefined} /> }]} />
                {isLoading ? <i className="fa fa-refresh fa-spin space-left" /> : null}
              </Fragment>
            }
            gridRight={
              <>
                <SettingsButton className="margin-left" />
                <AccountDropdown className="margin-left" />
              </>
            }
          />
        )}
        renderPageBody={() => (
          <div className="document-listing theme--pane layout-body">
            <div className="document-listing__body pad-bottom">
              <div className="row-spaced margin-top margin-bottom-sm">
                <h2 className="no-margin">Dashboard</h2>
                {this.renderDashboardMenu()}
              </div>
              <CardContainer>{cards}</CardContainer>
              {filter && cards.length === 0 && (
                <Notice color="subtle">
                  No documents found for <strong>{filter}</strong>
                </Notice>
              )}
            </div>
            <div className="document-listing__footer vertically-center">
              <span>
                {cards.length} {countLabel}
              </span>
            </div>
          </div>
        )}
      />
    );
  }
}

const mapDispatchToProps = (dispatch) => {
  const bound = bindActionCreators({
    createWorkspace,
    cloneGitRepository,
    importFile,
    importClipBoard,
    importUri,
  }, dispatch);

  return ({
    handleCreateWorkspace: bound.createWorkspace,
    handleGitCloneWorkspace: bound.cloneGitRepository,
    handleImportFile: bound.importFile,
    handleImportUri: bound.importUri,
    handleImportClipboard: bound.importClipBoard,
  });
};

export default connect(null, mapDispatchToProps)(WrapperHome);
