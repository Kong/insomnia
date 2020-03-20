// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../models/workspace';
import 'swagger-ui-react/swagger-ui.css';
import { Breadcrumb, Card, CardContainer, Header } from 'insomnia-components';
import DocumentCardDropdown from './dropdowns/document-card-dropdown';
import KeydownBinder from './keydown-binder';
import { executeHotKey } from '../../common/hotkeys-listener';
import { hotKeyRefs } from '../../common/hotkeys';
import { showPrompt } from './modals';
import * as models from '../../models';
import { trackEvent } from '../../common/analytics';
import YAML from 'yaml';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';
import type { GlobalActivity } from './activity-bar/activity-bar';
import { fuzzyMatch } from '../../common/misc';
import type { WrapperProps } from './wrapper';
import Notice from './notice';
import PageLayout from './page-layout';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from './base/dropdown';
import type {ForceToWorkspace} from '../redux/modules/helpers';
import {ForceToWorkspaceKeys} from '../redux/modules/helpers';
import designerLogo from '../images/insomnia-designer-logo.svg';
import {ACTIVITY_DEBUG, ACTIVITY_SPEC} from './activity-bar/activity-bar';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: (forceToWorkspace: ForceToWorkspace) => void,
  handleImportUri: (uri: string, forceToWorkspace: ForceToWorkspace) => void,
  handleImportClipboard: (forceToWorkspace: ForceToWorkspace) => void,
|};

type State = {|
  filter: string
|};

@autobind
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

  _handleWorkspaceCreate() {
    showPrompt({
      title: 'New Document',
      submitName: 'Create',
      placeholder: 'spec-name.yaml',
      selectText: true,
      onComplete: async name => {
        await models.workspace.create({
          name,
          scope: 'spec',
        });

        trackEvent('Workspace', 'Create');
      },
    });
  }

  _handleImportFile() {
    this.props.handleImportFile(ForceToWorkspaceKeys.new);
  }

  _handleImportClipBoard() {
    this.props.handleImportClipboard(ForceToWorkspaceKeys.new);
  }

  _handleImportUri() {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri, ForceToWorkspaceKeys.new);
      },
    });
  }

  _filterWorkspaces(): Array<Workspace> {
    const { workspaces } = this.props.wrapperProps;
    const { filter } = this.state;

    if (!filter) {
      return workspaces;
    }

    return workspaces.filter(w => {
      const result = fuzzyMatch(filter, w.name, {
        splitSpace: true,
        loose: true,
      });

      return !!result;
    });
  }

  _handleKeyDown(e) {
    executeHotKey(e, hotKeyRefs.FILTER_DOCUMENTS, () => {
      if (this._filterInput) {
        this._filterInput.focus();
      }
    });
  }

  async _handleSetActiveWorkspace(id: string, defaultActivity: GlobalActivity) {
    const { handleSetActiveWorkspace, handleSetActiveActivity } = this.props.wrapperProps;

    const selectedWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(id);
    handleSetActiveActivity(selectedWorkspaceMeta.activeActivity || defaultActivity);

    handleSetActiveWorkspace(id);
  }

  renderWorkspace(w: Workspace) {
    const {
      apiSpecs,
      handleDuplicateWorkspaceById,
      handleRenameWorkspace,
      handleDeleteWorkspaceById,
      workspaceMetas,
    } = this.props.wrapperProps;

    const { filter } = this.state;

    const apiSpec = apiSpecs.find(s => s.parentId === w._id);

    let spec = null;
    try {
      spec = YAML.parse(apiSpec ? apiSpec.contents : '');
    } catch (err) {
      // Assume there is no spec
      // TODO: Check for parse errors if it's an invalid spec
    }

    // Get cached branch from WorkspaceMeta
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === w._id);
    const lastActiveBranch = workspaceMeta ? workspaceMeta.cachedGitRepositoryBranch : null;
    const lastCommitAuthor = workspaceMeta ? workspaceMeta.cachedGitLastAuthor : null;
    const lastCommitTime = workspaceMeta ? workspaceMeta.cachedGitLastCommitTime : null;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta ? workspaceMeta.modified : w.modified;
    const modifiedLocally = apiSpec ? apiSpec.modified : workspaceModified;

    let log = <TimeFromNow timestamp={modifiedLocally} />;
    let branch = lastActiveBranch;
    if (apiSpec && lastCommitTime && apiSpec.modified > lastCommitTime) {
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
          <TimeFromNow timestamp={lastCommitTime} /> by {lastCommitAuthor}
        </React.Fragment>
      );
    }

    const docMenu = (
      <DocumentCardDropdown
        workspaceId={w._id}
        handleDuplicateWorkspaceById={handleDuplicateWorkspaceById}
        handleRenameWorkspaceById={handleRenameWorkspace}
        handleDeleteWorkspaceById={handleDeleteWorkspaceById}
      >...</DocumentCardDropdown>
    );

    if (spec || w.scope === 'spec') {
      let label: string = 'Unknown';
      if (spec && spec.openapi) {
        label = `OpenAPI ${spec.openapi}`;
      } else if (spec && spec.swagger) {
        label = `OpenAPI ${spec.swagger}`;
      }

      const version = (spec && spec.info && spec.info.version) ? spec.info.version : null;
      return (
        <Card
          key={w._id}
          docBranch={branch}
          docLog={log}
          docTitle={<Highlight search={filter} text={w.name} />}
          docVersion={version}
          onClick={() => this._handleSetActiveWorkspace(w._id, ACTIVITY_SPEC)}
          tagLabel={label}
          docMenu={docMenu}
        />
      );
    }

    return (
      <Card
        key={w._id}
        docBranch={branch}
        docLog={log}
        docTitle={<Highlight search={filter} text={w.name} />}
        docVersion=""
        onClick={() => this._handleSetActiveWorkspace(w._id, ACTIVITY_DEBUG)}
        tagLabel="Insomnia"
        docMenu={docMenu}
      />
    );
  }

  renderMenu() {
    return (
      <Dropdown outline>
        <DropdownButton className="margin-left btn-utility btn-create">
          Create <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownDivider>From</DropdownDivider>
        <DropdownItem onClick={this._handleWorkspaceCreate}>
          <i className="fa fa-pencil" />
          Scratch
        </DropdownItem>
        <DropdownItem onClick={this._handleImportFile}>
          <i className="fa fa-file" />
          File
        </DropdownItem>
        <DropdownItem onClick={this._handleImportUri}>
          <i className="fa fa-link" />
          URL
        </DropdownItem>
        <DropdownItem onClick={this._handleImportClipBoard}>
          <i className="fa fa-clipboard" />
          Clipboard
        </DropdownItem>
      </Dropdown>
    );
  }

  render() {
    const { filter } = this.state;
    const filteredWorkspaces = this._filterWorkspaces();

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
              className="app-header"
              gridLeft={
                <React.Fragment>
                    <img src={designerLogo} alt="Insomnia" width="24" height="24" />
                    <Breadcrumb className="breadcrumb" crumbs={['Documents']} />
                </React.Fragment>
              }
              gridCenter={
                <div className="form-control form-control--outlined no-margin">
                  <KeydownBinder onKeydown={this._handleKeyDown}>
                    <input
                      ref={this._setFilterInputRef}
                      type="text"
                      placeholder="Filter..."
                      onChange={this._handleFilterChange}
                      className="no-margin workspace-filter"
                    />
                    <span className="fa fa-search filter-icon"></span>
                  </KeydownBinder>
                </div>
              }
              gridRight={this.renderMenu()}
          />
        )}
        renderPageBody={() => (
            <div className="document-listing theme--pane layout-body pad-top">
              <div className="document-listing__body">
                <CardContainer>
                  {filteredWorkspaces.map(this.renderWorkspace)}
                </CardContainer>
                {filteredWorkspaces.length === 0 && (
                  <Notice color="subtle">
                    No workspaces found for <strong>{filter}</strong>
                  </Notice>
                )}
              </div>
            </div>
        )}
      />
    );
  }
}

export default WrapperHome;
