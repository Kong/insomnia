// @flow
import * as React from 'react';
import mkdirp from 'mkdirp';
import path from 'path';
import autobind from 'autobind-decorator';
import electron from 'electron';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import Tooltip from '../tooltip';
import * as session from '../../../account/session';
import type { GitLogEntry, GitRemoteConfig, GitStatusEntry } from '../../../sync/git/git-vcs';
import GitVCS, { FSPlugin, NeDBPlugin, routableFSPlugin } from '../../../sync/git/git-vcs';
import { showAlert, showPrompt } from '../modals';
import TimeFromNow from '../time-from-now';
import { getDataDirectory } from '../../../common/misc';

const { shell } = electron;

type Props = {|
  workspace: Workspace,

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
  vcs: GitVCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
      loadingPush: false,
      log: [],
      status: [],
    };

    this.vcs = new GitVCS();
  }

  async _refreshState(otherState?: Object) {
    this.setState({
      ...(otherState || {}),
      status: await this.vcs.status(),
      log: (await this.vcs.log()) || [],
    });
  }

  async _handleOpen() {
    await this._refreshState();
  }

  async _getOrCreateRemote(name: string): Promise<GitRemoteConfig | null> {
    const remote = await this.vcs.getRemote('origin');

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
          resolve(await this.vcs.addRemote(name, url));
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

  async _handlePush() {
    this.setState({ loadingPush: true });

    const remoteConfig = await this._getOrCreateRemote('origin');

    // User canceled prompt?
    if (remoteConfig === null) {
      this.setState({ loadingPush: false });
      return;
    }

    const { url, remote } = remoteConfig;

    let token = null;
    if (url.indexOf('https://github.com') === 0) {
      token = await this._promptForToken('GitHub');
    }

    try {
      await this.vcs.push(remote, token);
    } catch (err) {
      showAlert({ title: 'Push Error', message: 'Failed to push ' + err.message });
    }

    this.setState({ loadingPush: false });
  }

  async _handleLog() {
    const branch = await this.vcs.branch();
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
    const status = await this.vcs.status();

    let count = 0;
    for (const [name, head, workdir, stage] of status) {
      if (head === 1 && workdir === 1 && stage === 1) {
        // Nothing changed
        continue;
      }

      await this.vcs.add(name);
      count++;
    }

    if (count === 0) {
      showAlert({
        title: 'Git Error',
        message: 'Nothing changed',
      });

      return;
    }

    showPrompt({
      title: 'Commit',
      label: 'Commit message',
      onComplete: async message => {
        await this.vcs.commit(message, {
          name: 'Gregory Schier',
          email: 'xxxxxxxxxxxxxxxxxxxxx',
        });
      },
    });
  }

  async _handleShowGitDirectory() {
    shell.showItemInFolder(await this.vcs.getGitDirectory());
  }

  async componentDidMount() {
    const { workspace } = this.props;
    const dataDir = getDataDirectory();
    const gitDir = path.join(dataDir, `version-control/git/${workspace._id}.git`);

    // Create directory
    mkdirp.sync(gitDir);

    // Create FS plugin
    const pDir = NeDBPlugin.createPlugin(workspace._id);
    const pGit = FSPlugin.createPlugin();
    const fsPlugin = routableFSPlugin(pDir, { [gitDir]: pGit });

    // Init VCS
    await this.vcs.init('/', fsPlugin, gitDir);
    this._refreshState({ initializing: false });
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
          {session.isLoggedIn() && (
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
          )}
        </div>
      </DropdownButton>
    );
  }

  render() {
    const { className } = this.props;
    const { log } = this.state;

    const syncMenuHeader = <DropdownDivider>Git </DropdownDivider>;

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen}>
          {this.renderButton()}
          {syncMenuHeader}
          <DropdownItem onClick={this._handleCommit}>
            <i className="fa fa-cube" /> Commit Changes
          </DropdownItem>
          <DropdownItem onClick={this._handleLog} disabled={log.length === 0}>
            <i className="fa fa-clock-o" /> History
          </DropdownItem>
          <DropdownItem onClick={this._handlePush}>
            <i className="fa fa-cloud-upload" /> Push
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
