import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../common/constants';
import { Project } from '../../models/project';
import { VCS } from '../../sync/vcs/vcs';
import { showError } from './modals';

interface Props {
  vcs: VCS;
  branch: string;
  project: Project;
  onPull: (...args: any[]) => any;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
}

interface State {
  loading: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SyncPullButton extends PureComponent<Props, State> {
  _timeout: NodeJS.Timeout | null = null;

  state: State = {
    loading: false,
  };

  async _handleClick() {
    const { vcs, onPull, branch, project } = this.props;
    this.setState({
      loading: true,
    });
    const newVCS = vcs.newInstance();
    const oldBranch = await newVCS.getBranch();
    let failed = false;

    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      await newVCS.checkout([], branch);
      await newVCS.pull([], project.remoteId);
    } catch (err) {
      showError({
        title: 'Pull Error',
        message: 'Failed to pull ' + branch,
        error: err,
      });
      failed = true;
    } finally {
      // We actually need to checkout the old branch again because the VCS
      // stores it on the filesystem. We should probably have a way to not
      // have to do this hack
      await newVCS.checkout([], oldBranch);
    }

    // Do this a bit later so the loading doesn't seem to stop too early
    this._timeout = setTimeout(() => {
      this.setState({
        loading: false,
      });
    }, 400);

    if (!failed) {
      onPull?.();
    }
  }

  componentWillUnmount() {
    if (this._timeout !== null) {
      clearTimeout(this._timeout);
    }
  }

  render() {
    const { className, children, disabled } = this.props;
    const { loading } = this.state;
    return (
      <button className={className} onClick={this._handleClick} disabled={disabled}>
        {loading && <i className="fa fa-spin fa-refresh space-right" />}
        {children || 'Pull'}
      </button>
    );
  }
}

export default SyncPullButton;
