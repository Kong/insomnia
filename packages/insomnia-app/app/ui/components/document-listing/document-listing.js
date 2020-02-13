// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../../models/workspace';
import 'swagger-ui-react/swagger-ui.css';
import { fuzzyMatch } from '../../../common/misc';
import Highlight from '../base/highlight';
import Notice from '../notice';
import { AppHeader, Button, Card, CardContainer } from 'insomnia-components';
import KeydownBinder from '../keydown-binder';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { hotKeyRefs } from '../../../common/hotkeys';
import { showPrompt } from '../modals';
import * as models from '../../../models';
import { trackEvent } from '../../../common/analytics';
import type { ApiSpec } from '../../../models/api-spec';
import YAML from 'yaml';
import TimeFromNow from '../time-from-now';
import type { GlobalActivity } from '../activity-bar/activity-bar';
import type { WorkspaceMeta } from '../../../models/workspace-meta';

type Props = {|
  activeWorkspace: Workspace,
  apiSpecs: Array<ApiSpec>,
  workspaces: Array<Workspace>,
  workspaceMetas: Array<WorkspaceMeta>,
  handleSetActiveWorkspace: (workspaceId: string) => any,
  handleSetActiveActivity: (activity: GlobalActivity) => any,
|};

type State = {|
  filter: string
|};

@autobind
class DocumentListing extends React.PureComponent<Props, State> {
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
        const workspace = await models.workspace.create({
          name,
          scope: 'spec',
        });
        this.props.handleSetActiveWorkspace(workspace._id);

        trackEvent('Workspace', 'Create');
      },
    });
  }

  _filterWorkspaces(): Array<Workspace> {
    const { workspaces } = this.props;
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

  _handleSetActiveWorkspace(id: string, activity: GlobalActivity) {
    const { handleSetActiveWorkspace, handleSetActiveActivity } = this.props;

    handleSetActiveActivity(activity);
    handleSetActiveWorkspace(id);
  }

  renderWorkspace(w: Workspace) {
    const { apiSpecs, workspaceMetas } = this.props;
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
          <TimeFromNow timestamp={modifiedLocally} /> (unsaved)
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
          onClick={() => this._handleSetActiveWorkspace(w._id, 'spec')}
          tagLabel={label}
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
        onClick={() => this._handleSetActiveWorkspace(w._id, 'debug')}
        tagLabel="Insomnia"
      />
    );
  }

  render() {
    const { filter } = this.state;
    const filteredWorkspaces = this._filterWorkspaces();

    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <div className="document-listing theme--pane">
          <AppHeader />
          <div className="document-listing__body">
            <header className="document-listing__header">
              <h1>Documents</h1>
              <div className="form-control form-control--outlined">
                <input
                  ref={this._setFilterInputRef}
                  type="text"
                  placeholder="filter"
                  onChange={this._handleFilterChange}
                />
              </div>
              <Button onClick={this._handleWorkspaceCreate}>Add New</Button>
            </header>
            <CardContainer>
              {filteredWorkspaces.map(this.renderWorkspace)}
            </CardContainer>
            {filteredWorkspaces.length === 0 && (
              <Notice color="subtle">No workspaces found for <strong>{filter}</strong></Notice>
            )}
          </div>
        </div>
      </KeydownBinder>
    );
  }
}

export default DocumentListing;
