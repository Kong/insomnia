// @flow
import * as React from 'react';
import fs from 'fs';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import type { Workspace } from '../../../models/workspace';
import Tooltip from '../tooltip';
import * as session from '../../../account/session';
import GitVCS, { NeDBPlugin, routableFSPlugin } from '../../../sync/git/git-vcs';

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
  checkInterval: IntervalID;
  refreshOnNextSyncItems = false;
  lastUserActivity = Date.now();
  vcs: GitVCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      initializing: false,
    };

    this.vcs = new GitVCS();
    this.vcs.init('/', '');
  }

  _handleOpen() {}

  async _handleCommit() {
    console.log('Status', await this.vcs.status());
  }

  async componentDidMount() {
    const { workspace } = this.props;
    const gitDir = '/Users/greg.schier/Desktop/git';
    const fsPlugin = routableFSPlugin(NeDBPlugin.createPlugin(workspace._id), {
      [gitDir]: fs,
    });
    await this.vcs.init('/', fsPlugin, gitDir);
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
              <i className="fa fa-save" /> Commit
            </React.Fragment>
          </DropdownItem>
        </Dropdown>
      </div>
    );
  }
}

export default GitSyncDropdown;
