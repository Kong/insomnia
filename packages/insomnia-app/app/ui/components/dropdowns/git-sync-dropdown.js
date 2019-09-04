// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import electron from 'electron';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import Tooltip from '../tooltip';
import type { GitLogEntry, GitRemoteConfig, GitStatusEntry } from '../../../sync/git/git-vcs';
import GitVCS from '../../../sync/git/git-vcs';
import { showAlert, showModal, showPrompt } from '../modals';
import TimeFromNow from '../time-from-now';
import GitConfigModal from '../modals/git-config-modal';
import GitStagingModal from '../modals/git-staging-modal';

const { shell } = electron;

type Props = {|
  workspace: Workspace,
  vcs: GitVCS,

  // Optional
  className?: string,
|};

type State = {|
  initializing: boolean,
  loadingPush: boolean,
  log: Array<GitLogEntry>,
  status: Array<GitStatusEntry>,
|};

@autobind
class GitSyncDropdown extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
      loadingPush: false,
      log: [],
      status: [],
    };
  }

  async _refreshState(otherState?: Object) {
    const { vcs } = this.props;
    this.setState({
      ...(otherState || {}),
      status: await vcs.status(),
      log: (await vcs.log()) || [],
    });
  }

  async _handleOpen() {
    await this._refreshState();
  }

  async _getOrCreateRemote(name: string): Promise<GitRemoteConfig | null> {
    const { vcs } = this.props;
    const remote = await vcs.getRemote('origin');

    if (remote) {
      return remote;
    }

    return new Promise(resolve => {
      showPrompt({
        title: 'Add Remote',
        label: 'HTTP URL of remote',
        onCancel: () => {
          resolve(null);
        },
        onComplete: async url => {
          resolve(await vcs.addRemote(name, url));
        },
      });
    });
  }

  async _promptForToken(label: string) {
    return new Promise(resolve => {
      showPrompt({
        title: `${label} Token`,
        label: 'Application token for auth',
        onCancel: () => {
          resolve(null);
        },
        onComplete: url => {
          resolve(url);
        },
      });
    });
  }

  async _handlePull() {
    showAlert({ title: 'To-Do' });
  }

  async _handlePush() {
    const { vcs } = this.props;

    this.setState({ loadingPush: true });

    const remoteConfig = await this._getOrCreateRemote('origin');

    // User canceled prompt?
    if (remoteConfig === null) {
      this.setState({ loadingPush: false });
      return;
    }

    const { url, remote } = remoteConfig;

    let token;
    if (url.indexOf('https://github.com') === 0) {
      token = await this._promptForToken('GitHub');
    }

    try {
      await vcs.push(remote, token);
    } catch (err) {
      showAlert({
        title: 'Push Error',
        message: `Failed to push ${err.message}`,
      });
    }

    this.setState({ loadingPush: false });
  }

  async _handleConfig() {
    showModal(GitConfigModal, {});
  }

  async _handleLog() {
    const { vcs } = this.props;
    const branch = await vcs.branch();
    const { log } = this.state;

    showAlert({
      title: 'Git Log',
      message: log ? (
        <table className="table--fancy table--striped">
          <thead>
            <tr>
              <th className="text-left">Message</th>
              <th className="text-left">When</th>
              <th className="text-left">Author</th>
            </tr>
          </thead>
          <tbody>
            {log.map(({ author, message, oid }) => (
              <tr key={oid}>
                <td>add{message}</td>
                <td>
                  <TimeFromNow
                    className="no-wrap"
                    timestamp={author.timestamp * 1000}
                    intervalSeconds={30}
                  />
                </td>
                <td>{author.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <React.Fragment>
          No history yet for branch <code>{branch}</code>
        </React.Fragment>
      ),
    });
  }

  async _handleCommit() {
    showModal(GitStagingModal, {});
    // const { vcs } = this.props;
    // const status = await vcs.status();
    //
    // let count = 0;
    // for (const [name, head, workdir, stage] of status) {
    //   if (head === 1 && workdir === 1 && stage === 1) {
    //     // Nothing changed
    //     continue;
    //   }
    //
    //   await vcs.add(name);
    //   count++;
    // }
    //
    // if (count === 0) {
    //   showAlert({
    //     title: 'Git Error',
    //     message: 'Nothing changed',
    //   });
    //
    //   return;
    // }
    //
    // showPrompt({
    //   title: 'Commit',
    //   label: 'Commit message',
    //   onComplete: async message => {
    //     await vcs.commit(message, {
    //       name: 'Gregory Schier',
    //       email: 'xxxxxxxxxxxxxxxxxxxxx',
    //     });
    //   },
    // });
  }

  async _handleShowGitDirectory() {
    const { vcs } = this.props;
    shell.showItemInFolder(await vcs.getGitDirectory());
  }

  componentDidMount() {
    this._refreshState();
  }

  renderButton() {
    const { loadingPush } = this.state;

    const initializing = false;
    const currentBranch = 'master';
    const snapshotToolTipMsg = 'TO-DO';
    const pushToolTipMsg = 'TO-DO';
    const pullToolTipMsg = 'TO-DO';
    const canCreateSnapshot = true;
    const canPull = true;
    const canPush = true;

    const loadingIcon = <i className="fa fa-spin fa-refresh fa--fixed-width" />;

    return (
      <DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced">
        <div className="ellipsis">
          <i className="fa fa-code-fork space-right" />{' '}
          {initializing ? 'Initializing...' : currentBranch}
        </div>
        <div className="space-left">
          <Tooltip message={snapshotToolTipMsg} delay={800}>
            <i
              className={classnames('icon fa fa-cube fa--fixed-width', {
                'super-duper-faint': !canCreateSnapshot,
              })}
            />
          </Tooltip>

          {/* Only show cloud icons if logged in */}
          <React.Fragment>
            <Tooltip message={pullToolTipMsg} delay={800}>
              <i
                className={classnames('fa fa-cloud-download fa--fixed-width', {
                  'super-duper-faint': !canPull,
                })}
              />
            </Tooltip>

            {loadingPush ? (
              loadingIcon
            ) : (
              <Tooltip message={pushToolTipMsg} delay={800}>
                <i
                  className={classnames('fa fa-cloud-upload fa--fixed-width', {
                    'super-duper-faint': !canPush,
                  })}
                />
              </Tooltip>
            )}
          </React.Fragment>
        </div>
      </DropdownButton>
    );
  }

  render() {
    const { className } = this.props;
    const { log } = this.state;

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen}>
          {this.renderButton()}

          <DropdownDivider>Git Project</DropdownDivider>

          <DropdownItem onClick={this._handleCommit}>
            <i className="fa fa-check" /> Commit Changes
          </DropdownItem>
          <DropdownItem onClick={this._handleLog} disabled={log.length === 0}>
            <i className="fa fa-clock-o" /> History
          </DropdownItem>
          <DropdownItem onClick={this._handlePush}>
            <i className="fa fa-cloud-upload" /> Push
          </DropdownItem>
          <DropdownItem onClick={this._handlePull}>
            <i className="fa fa-cloud-download" /> Pull
          </DropdownItem>

          <DropdownDivider>Settings</DropdownDivider>

          <DropdownItem onClick={this._handleConfig}>
            <i className="fa fa-wrench" /> Git Config
          </DropdownItem>
          <DropdownItem onClick={this._handleShowGitDirectory}>
            <i className="fa fa-folder-o" /> Reveal Git Directory
          </DropdownItem>
        </Dropdown>
      </div>
    );
  }
}

export default GitSyncDropdown;
