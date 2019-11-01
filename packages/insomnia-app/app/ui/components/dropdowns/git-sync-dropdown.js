// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import electron from 'electron';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import type { GitLogEntry, GitStatus } from '../../../sync/git/git-vcs';
import GitVCS from '../../../sync/git/git-vcs';
import { showAlert, showError, showModal } from '../modals';
import GitStagingModal from '../modals/git-staging-modal';
import * as db from '../../../common/database';
import type { GitRepository } from '../../../models/git-repository';
import GitRepositorySettingsModal from '../modals/git-repository-settings-modal';
import GitLogModal from '../modals/git-log-modal';
import Tooltip from '../tooltip';
import GitBranchesModal from '../modals/git-branches-modal';

const { shell } = electron;

type Props = {|
  handleInitializeEntities: () => void,
  workspace: Workspace,
  vcs: GitVCS,
  gitRepository: GitRepository | null,

  // Optional
  className?: string,
|};

type State = {|
  initializing: boolean,
  loadingPush: boolean,
  loadingPull: boolean,
  log: Array<GitLogEntry>,
  status: GitStatus,
  branch: string,
  branches: Array<string>,
|};

@autobind
class GitSyncDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
      loadingPush: false,
      loadingPull: false,
      log: [],
      status: {
        hasChanges: false,
        allStaged: false,
        allUnstaged: true,
        entries: [],
      },
      branch: '',
      branches: [],
    };
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  async _refreshState(otherState?: Object) {
    const { vcs } = this.props;

    if (!vcs.isInitialized()) {
      return;
    }

    this.setState({
      ...(otherState || {}),
      status: await vcs.status(),
      log: (await vcs.log()) || [],
      branch: await vcs.getBranch(),
      branches: await vcs.listBranches(),
    });
  }

  async _handleOpen() {
    await this._refreshState();
  }

  async _handlePull() {
    this.setState({ loadingPull: true });
    const { vcs, gitRepository } = this.props;

    if (!gitRepository) {
      // Should never happen
      throw new Error('Tried to pull without configuring git repo');
    }

    const bufferId = await db.bufferChanges();
    try {
      await vcs.pull(gitRepository.credentials);
    } catch (err) {
      showError({ title: 'Pull Error', error: err });
    }
    await db.flushChanges(bufferId);

    this.setState({ loadingPull: false });
  }

  async _handlePush(e: any, force: boolean = false) {
    const { vcs, gitRepository } = this.props;

    if (!gitRepository) {
      // Should never happen
      throw new Error('Tried to push without configuring git repo');
    }

    const canPush = await vcs.canPush(gitRepository.credentials);
    if (!canPush) {
      showAlert({
        title: 'Push Skipped',
        message: 'Everything up-to-date. Nothing was pushed to the remote',
      });
      return;
    }

    this.setState({ loadingPush: true });

    const bufferId = await db.bufferChanges();
    try {
      await vcs.push(gitRepository.credentials, force);
    } catch (err) {
      if (err.code === 'PushRejectedNonFastForward') {
        this._dropdown && this._dropdown.hide();
        showAlert({
          title: 'Push Rejected',
          message: 'Do you want to force push?',
          okLabel: 'Force Push',
          addCancel: true,
          onConfirm: () => {
            this._handlePush(null, true);
          },
        });
      } else {
        showError({ title: 'Push Error', error: err });
      }
    }

    await db.flushChanges(bufferId);

    this.setState({ loadingPush: false });
  }

  _handleConfig() {
    const { gitRepository } = this.props;
    showModal(GitRepositorySettingsModal, { gitRepository });
  }

  _handleLog() {
    showModal(GitLogModal);
  }

  async _handleCommit() {
    showModal(GitStagingModal, { onCommit: this._refreshState });
  }

  async _handleShowGitDirectory() {
    const { vcs } = this.props;
    shell.showItemInFolder(await vcs.getGitDirectory());
  }

  _handleManageBranches() {
    showModal(GitBranchesModal, { onHide: this._refreshState });
  }

  async _handleCheckoutBranch(branch: string) {
    const { vcs, handleInitializeEntities } = this.props;

    const bufferId = await db.bufferChanges();
    try {
      await vcs.checkout(branch);
    } catch (err) {
      showError({ title: 'Checkout Error', error: err });
    }
    await db.flushChanges(bufferId, true);

    handleInitializeEntities();
    await this._refreshState();
  }

  componentDidMount() {
    this._refreshState();
  }

  renderButton() {
    const { status, branch } = this.state;
    const { vcs } = this.props;

    if (!vcs.isInitialized()) {
      return (
        <DropdownButton className="btn btn--compact wide">
          <i className="fa fa-code-fork space-right" />
          Setup Git Sync
        </DropdownButton>
      );
    }

    const initializing = false;
    const currentBranch = branch;
    const canCommit = status.hasChanges;
    const commitTooltip = canCommit
      ? 'You have changes ready to commit'
      : 'You do not have any changes to commit';

    return (
      <DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced">
        <div className="ellipsis">
          <i className="fa fa-code-fork space-right" />{' '}
          {initializing ? 'Initializing...' : currentBranch}
        </div>
        <div className="space-left">
          <Tooltip message={commitTooltip} delay={500}>
            <i
              className={classnames('icon fa fa-check fa--fixed-width', {
                'super-duper-faint': !canCommit,
              })}
            />
          </Tooltip>
        </div>
      </DropdownButton>
    );
  }

  renderBranch(branch: string) {
    const { branch: currentBranch } = this.state;

    const icon =
      branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;

    const isCurrentBranch = branch === currentBranch;
    return (
      <DropdownItem
        key={branch}
        onClick={isCurrentBranch ? null : () => this._handleCheckoutBranch(branch)}
        className={classnames({ bold: isCurrentBranch })}
        title={isCurrentBranch ? null : `Switch to "${branch}"`}>
        {icon}
        {branch}
      </DropdownItem>
    );
  }

  render() {
    const { className, vcs } = this.props;
    const { log, status, branches, branch, loadingPull, loadingPush } = this.state;

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen} ref={this._setDropdownRef}>
          {this.renderButton()}

          <DropdownDivider>Git Sync</DropdownDivider>

          <DropdownItem onClick={this._handleConfig}>
            <i className="fa fa-wrench" /> Repository Settings
          </DropdownItem>

          {vcs.isInitialized() && (
            <React.Fragment>
              <DropdownItem onClick={this._handleShowGitDirectory}>
                <i className="fa fa-folder-o" /> Reveal Git Directory
              </DropdownItem>
              <DropdownItem onClick={this._handleManageBranches}>
                <i className="fa fa-code-fork" /> Branches
              </DropdownItem>
            </React.Fragment>
          )}

          {vcs.isInitialized() && (
            <React.Fragment>
              <DropdownDivider>Branches</DropdownDivider>
              {branches.map(this.renderBranch)}

              <DropdownDivider>{branch}</DropdownDivider>

              <DropdownItem onClick={this._handleCommit} disabled={!status.hasChanges}>
                <i className="fa fa-check" /> Commit
              </DropdownItem>
              {log.length > 0 && (
                <DropdownItem onClick={this._handlePush} stayOpenAfterClick>
                  <i
                    className={classnames({
                      fa: true,
                      'fa-spin fa-refresh': loadingPush,
                      'fa-cloud-upload': !loadingPush,
                    })}
                  />{' '}
                  Push
                </DropdownItem>
              )}
              <DropdownItem onClick={this._handlePull} stayOpenAfterClick>
                <i
                  className={classnames({
                    fa: true,
                    'fa-spin fa-refresh': loadingPull,
                    'fa-cloud-download': !loadingPull,
                  })}
                />{' '}
                Pull
              </DropdownItem>
              <DropdownItem onClick={this._handleLog} disabled={log.length === 0}>
                <i className="fa fa-clock-o" /> History ({log.length})
              </DropdownItem>
            </React.Fragment>
          )}
        </Dropdown>
      </div>
    );
  }
}

export default GitSyncDropdown;
