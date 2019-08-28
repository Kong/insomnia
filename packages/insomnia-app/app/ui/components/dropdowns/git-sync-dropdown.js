// @flow
import * as React from 'react';
import mkdirp from 'mkdirp';
import path from 'path';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import Tooltip from '../tooltip';
import * as session from '../../../account/session';
import GitVCS, { FSPlugin, NeDBPlugin, routableFSPlugin } from '../../../sync/git/git-vcs';
import { showAlert, showPrompt } from '../modals';
import TimeFromNow from '../time-from-now';
import { getDataDirectory } from '../../../common/misc';

type Props = {
  workspace: Workspace,

  // Optional
  className?: string,
};

type State = {
  initializing: boolean,
};

@autobind
class GitSyncDropdown extends React.PureComponent<Props, State> {
  vcs: GitVCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
    };

    this.vcs = new GitVCS();
  }

  _handleOpen() {}

  async _handlePush() {
    await this.vcs.push();
    console.log('PUsh complete');
  }

  async _handleLog() {
    const log = await this.vcs.log();
    showAlert({
      title: 'Git Log',
      message: (
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
                <td>{message}</td>
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

    // Test it out
    const log = await this.vcs.log();
    console.log('Log', log);

    const status = await this.vcs.status();
    console.log('Status', status);

    this.setState({ initializing: false });
  }

  renderButton() {
    const initializing = false;
    const currentBranch = 'master';
    const snapshotToolTipMsg = 'TO-DO';
    const pushToolTipMsg = 'TO-DO';
    const pullToolTipMsg = 'TO-DO';
    const canCreateSnapshot = true;
    const canPull = true;
    const canPush = true;

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

              <Tooltip message={pushToolTipMsg} delay={800}>
                <i
                  className={classnames('fa fa-cloud-upload fa--fixed-width', {
                    'super-duper-faint': !canPush,
                  })}
                />
              </Tooltip>
            </React.Fragment>
          )}
        </div>
      </DropdownButton>
    );
  }

  render() {
    const { className } = this.props;

    const syncMenuHeader = <DropdownDivider>Git </DropdownDivider>;

    return (
      <div className={className}>
        <Dropdown className="wide tall" onOpen={this._handleOpen}>
          {this.renderButton()}
          {syncMenuHeader}
          <DropdownItem onClick={this._handleCommit}>
            <React.Fragment>
              <i className="fa fa-save" /> Commit Changes
            </React.Fragment>
          </DropdownItem>
          <DropdownItem onClick={this._handleLog}>
            <React.Fragment>
              <i className="fa fa-line-chart" /> Show Log
            </React.Fragment>
          </DropdownItem>
          <DropdownItem onClick={this._handlePush}>
            <React.Fragment>
              <i className="fa fa-cloud-upload" /> Push
            </React.Fragment>
          </DropdownItem>
        </Dropdown>
      </div>
    );
  }
}

export default GitSyncDropdown;
