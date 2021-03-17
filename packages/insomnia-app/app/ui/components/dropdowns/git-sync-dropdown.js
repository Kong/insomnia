// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import type { GitLogEntry } from '../../../sync/git/git-vcs';
import GitVCS from '../../../sync/git/git-vcs';
import { showAlert, showError, showModal } from '../modals';
import GitStagingModal from '../modals/git-staging-modal';
import * as db from '../../../common/database';
import * as models from '../../../models';
import type { GitRepository } from '../../../models/git-repository';
import GitRepositorySettingsModal from '../modals/git-repository-settings-modal';
import GitLogModal from '../modals/git-log-modal';
import GitBranchesModal from '../modals/git-branches-modal';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import { trackEvent } from '../../../common/analytics';
import { docsGitSync } from '../../../common/documentation';
import { isNotNullOrUndefined } from '../../../common/misc';

type Props = {|
  handleInitializeEntities: () => Promise<void>,
  handleGitBranchChanged: (branch: string) => void,
  workspace: Workspace,
  vcs: GitVCS,
  gitRepository: GitRepository | null,

  // Optional
  className?: string,
  renderDropdownButton?: (children: React.Node) => React.Node,
|};

type State = {|
  initializing: boolean,
  loadingPush: boolean,
  loadingPull: boolean,
  log: Array<GitLogEntry>,
  branch: string,
  branches: Array<string>,
|};

@autoBindMethodsForReact(AUTOBIND_CFG)
class GitSyncDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
      loadingPush: false,
      loadingPull: false,
      log: [],
      branch: '',
      branches: [],
    };
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  async _refreshState(otherState?: Object) {
    const { vcs, workspace, handleGitBranchChanged } = this.props;

    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    // Clear cached items and return if no state
    if (!vcs.isInitialized() || !workspaceMeta.gitRepositoryId) {
      // Don't update unnecessarily
      const needsUpdate = [
        workspaceMeta.cachedGitRepositoryBranch,
        workspaceMeta.cachedGitLastAuthor,
        workspaceMeta.cachedGitLastCommitTime,
      ].some(isNotNullOrUndefined);

      if (needsUpdate) {
        await models.workspaceMeta.updateByParentId(workspace._id, {
          cachedGitRepositoryBranch: null,
          cachedGitLastAuthor: null,
          cachedGitLastCommitTime: null,
        });
      }
      return;
    }

    const branch = await vcs.getBranch();
    const branches = await vcs.listBranches();
    const log = (await vcs.log()) || [];
    this.setState({ ...(otherState || {}), log, branch, branches });

    const author = log[0] ? log[0].author : null;
    const cachedGitRepositoryBranch = branch;
    const cachedGitLastAuthor = author ? author.name : null;

    // NOTE: We're converting timestamp to ms here
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : null;
    await models.workspaceMeta.updateByParentId(workspace._id, {
      cachedGitRepositoryBranch,
      cachedGitLastAuthor,
      cachedGitLastCommitTime,
    });
    handleGitBranchChanged(branch);
  }

  async _handleOpen() {
    trackEvent('Git Dropdown', 'Open');
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
      showError({ title: 'Error Pulling Repository', error: err });
    }
    await db.flushChanges(bufferId);

    this.setState({ loadingPull: false });
  }

  async _handlePush(e: any, force: boolean = false) {
    this.setState({ loadingPush: true });
    const { vcs, gitRepository } = this.props;

    if (!gitRepository) {
      // Should never happen
      throw new Error('Tried to push without configuring git repo');
    }

    // Check if there is anything to push
    let canPush = false;
    try {
      canPush = await vcs.canPush(gitRepository.credentials);
    } catch (err) {
      showError({ title: 'Error Pushing Repository', error: err });
      this.setState({ loadingPush: false });
      return;
    }

    // If nothing to push, display that to the user
    if (!canPush) {
      showAlert({
        title: 'Push Skipped',
        message: 'Everything up-to-date. Nothing was pushed to the remote',
      });
      this.setState({ loadingPush: false });
      return;
    }

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
        showError({ title: 'Error Pushing Repository', error: err });
      }
    }

    await db.flushChanges(bufferId);

    this.setState({ loadingPush: false });
  }

  _handleConfig() {
    const { gitRepository } = this.props;
    showModal(GitRepositorySettingsModal, {
      gitRepository,
      onSubmitEdits: async patch => {
        const { workspace } = this.props;
        const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

        if (gitRepository) {
          await models.gitRepository.update(gitRepository, patch);
        } else {
          const repo = await models.gitRepository.create(patch);
          await models.workspaceMeta.update(workspaceMeta, { gitRepositoryId: repo._id });
        }
      },
    });
  }

  _handleLog() {
    showModal(GitLogModal);
  }

  async _handleCommit() {
    showModal(GitStagingModal, { onCommit: this._refreshState });
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

    await handleInitializeEntities();
    await this._refreshState();
  }

  componentDidMount() {
    this._refreshState();
  }

  renderButton() {
    const { branch } = this.state;
    const { vcs, renderDropdownButton } = this.props;

    const renderBtn =
      renderDropdownButton ||
      (children => (
        <DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced">
          {children}
        </DropdownButton>
      ));

    if (!vcs.isInitialized()) {
      return renderBtn(
        <React.Fragment>
          <i className="fa fa-code-fork space-right" />
          Setup Git Sync
        </React.Fragment>,
      );
    }

    const initializing = false;
    return renderBtn(
      <React.Fragment>
        <div className="ellipsis">{initializing ? 'Initializing...' : branch}</div>
        <i className="fa fa-code-fork space-left" />
      </React.Fragment>,
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
    const { log, branches, branch, loadingPull, loadingPush } = this.state;

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen} ref={this._setDropdownRef}>
          {this.renderButton()}

          <DropdownDivider>
            Git Sync
            <HelpTooltip>
              Sync and collaborate with Git{' '}
              <Link href={docsGitSync}>
                <span className="no-wrap">
                  <br />
                  Documentation <i className="fa fa-external-link" />
                </span>
              </Link>
            </HelpTooltip>
          </DropdownDivider>

          <DropdownItem onClick={this._handleConfig}>
            <i className="fa fa-wrench" /> Repository Settings
          </DropdownItem>

          {vcs.isInitialized() && (
            <React.Fragment>
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

              <DropdownItem onClick={this._handleCommit}>
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
