// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import type { GlobalActivity } from '../../common/constants';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  AUTOBIND_CFG,
  getAppName,
  isWorkspaceActivity,
} from '../../common/constants';
import type { Workspace } from '../../models/workspace';
import { WorkspaceScopeKeys } from '../../models/workspace';
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
  SvgIcon,
} from 'insomnia-components';
import DocumentCardDropdown from './dropdowns/document-card-dropdown';
import KeydownBinder from './keydown-binder';
import { executeHotKey } from '../../common/hotkeys-listener';
import { hotKeyRefs } from '../../common/hotkeys';
import { showPrompt } from './modals';
import * as models from '../../models';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';

import { fuzzyMatchAll, isNotNullOrUndefined, pluralize } from '../../common/misc';
import type {
  HandleImportClipboardCallback,
  HandleImportFileCallback,
  HandleImportUriCallback,
  WrapperProps,
} from './wrapper';
import Notice from './notice';
import PageLayout from './page-layout';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';
import coreLogo from '../images/insomnia-core-logo.png';
import { parseApiSpec } from '../../common/api-specs';
import RemoteWorkspacesDropdown from './dropdowns/remote-workspaces-dropdown';
import SettingsButton from './buttons/settings-button';
import AccountDropdown from './dropdowns/account-dropdown';
import { strings } from '../../common/strings';
import { descendingNumberSort } from '../../common/sorting';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as workspaceActions from '../redux/modules/workspace';
import * as gitActions from '../redux/modules/git';
import { GitCloneWorkspaceCallback } from '../redux/modules/workspace';
import { MemClient } from '../../sync/git/mem-client';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: HandleImportFileCallback,
  handleImportUri: HandleImportUriCallback,
  handleImportClipboard: HandleImportClipboardCallback,
  handleCreateWorkspace: CreateWorkspaceCallback,
  handleGitCloneWorkspace: GitCloneWorkspaceCallback,
|};

type State = {|
  filter: string,
|};

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperHome extends React.PureComponent<Props, State> {
  state = {
    filter: '',
  };

  _filterInput: ?HTMLInputElement;

  _setFilterInputRef(n: ?HTMLInputElement) {
    this._filterInput = n;
  }

  _handleFilterChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ filter: e.currentTarget.value });
  }

  _handleDocumentCreate() {
    this.props.handleCreateWorkspace({ scope: WorkspaceScopeKeys.design });
  }

  _handleCollectionCreate() {
    this.props.handleCreateWorkspace({ scope: WorkspaceScopeKeys.collection });
  }

  _handleImportFile() {
    this.props.handleImportFile({ forceToWorkspace: ForceToWorkspaceKeys.new });
  }

  _handleImportClipBoard() {
    this.props.handleImportClipboard({ forceToWorkspace: ForceToWorkspaceKeys.new });
  }

  _handleImportUri() {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri, { forceToWorkspace: ForceToWorkspaceKeys.new });
      },
    });
  }

  _handleWorkspaceClone() {
    this.props.handleGitCloneWorkspace({ createFsClient: MemClient.createClient });
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

  renderCard(workspace: Workspace): { card: React.Node, lastModifiedTimestamp: number } {
    const {
      apiSpecs,
      handleSetActiveWorkspace,
      workspaceMetas,
      workspaces,
    } = this.props.wrapperProps;

    const { filter } = this.state;

    const apiSpec = apiSpecs.find(s => s.parentId === workspace._id);

    let spec = null;
    let specFormat = null;
    let specFormatVersion = null;
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
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);
    const lastActiveBranch = workspaceMeta ? workspaceMeta.cachedGitRepositoryBranch : null;
    const lastCommitAuthor = workspaceMeta ? workspaceMeta.cachedGitLastAuthor : null;
    const lastCommitTime = workspaceMeta ? workspaceMeta.cachedGitLastCommitTime : null;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta ? workspaceMeta.modified : workspace.modified;
    const modifiedLocally =
      apiSpec && workspace.scope === WorkspaceScopeKeys.design
        ? apiSpec.modified
        : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      apiSpec?.modified,
      workspaceMeta?.cachedGitLastCommitTime,
    ];
    const lastModifiedTimestamp = lastModifiedFrom
      .filter(isNotNullOrUndefined)
      .sort(descendingNumberSort)[0];

    let log = <TimeFromNow timestamp={lastModifiedTimestamp} />;
    let branch = lastActiveBranch;
    if (
      workspace.scope === WorkspaceScopeKeys.design &&
      lastCommitTime &&
      apiSpec?.modified > lastCommitTime
    ) {
      // Show locally unsaved changes for spec
      // NOTE: this doesn't work for non-spec workspaces
      branch = lastActiveBranch + '*';
      log = (
        <React.Fragment>
          <TimeFromNow className="text-danger" timestamp={modifiedLocally} /> (unsaved)
        </React.Fragment>
      );
    } else if (lastCommitTime) {
      // Show last commit time and author
      branch = lastActiveBranch;
      log = (
        <React.Fragment>
          <TimeFromNow timestamp={lastCommitTime} /> {lastCommitAuthor && `by ${lastCommitAuthor}`}
        </React.Fragment>
      );
    }

    const docMenu = (
      <DocumentCardDropdown
        apiSpec={apiSpec}
        workspace={workspace}
        handleSetActiveWorkspace={handleSetActiveWorkspace}
        isLastWorkspace={workspaces.length === 1}>
        <SvgIcon icon="ellipsis" />
      </DocumentCardDropdown>
    );
    const version = spec?.info?.version || '';
    let label: string = strings.collection;
    let format: string = '';
    let labelIcon = <i className="fa fa-bars" />;
    let defaultActivity = ACTIVITY_DEBUG;
    let title = workspace.name;

    if (workspace.scope === WorkspaceScopeKeys.design) {
      label = strings.document;
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
        docBranch={branch && <Highlight search={filter} text={branch} />}
        docTitle={title && <Highlight search={filter} text={title} />}
        docVersion={version && <Highlight search={filter} text={`v${version}`} />}
        tagLabel={
          label && (
            <>
              <span className="margin-right-xs">{labelIcon}</span>
              <Highlight search={filter} text={label} />
            </>
          )
        }
        docLog={log}
        docMenu={docMenu}
        docFormat={format}
        onClick={() => this._handleClickCard(workspace._id, defaultActivity)}
      />
    );

    return {
      card,
      lastModifiedTimestamp,
    };
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
    const { vcs, workspaces } = this.props.wrapperProps;
    return (
      <div className="row row--right pad-left wide">
        <div
          className="form-control form-control--outlined no-margin"
          style={{ maxWidth: '400px' }}>
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
        <RemoteWorkspacesDropdown vcs={vcs} workspaces={workspaces} className="margin-left" />
        {this.renderCreateMenu()}
      </div>
    );
  }

  render() {
    const { workspaces, isLoading } = this.props.wrapperProps;
    const { filter } = this.state;

    // Render each card, removing all the ones that don't match the filter
    const cards = workspaces
      .map(this.renderCard)
      .filter(isNotNullOrUndefined)
      .sort((a, b) => descendingNumberSort(a.lastModifiedTimestamp, b.lastModifiedTimestamp))
      .map(c => c.card);

    const countLabel = cards.length > 1 ? pluralize(strings.document) : strings.document;

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header theme--app-header"
            gridLeft={
              <React.Fragment>
                <img src={coreLogo} alt="Insomnia" width="24" height="24" />
                <Breadcrumb className="breadcrumb" crumbs={[getAppName()]} />
                {isLoading ? <i className="fa fa-refresh fa-spin space-left" /> : null}
              </React.Fragment>
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

function mapDispatchToProps(dispatch) {
  return {
    handleCreateWorkspace: bindActionCreators(workspaceActions.createWorkspace, dispatch),
    handleGitCloneWorkspace: bindActionCreators(gitActions.cloneGitRepository, dispatch),
  };
}

export default connect(null, mapDispatchToProps)(WrapperHome);
