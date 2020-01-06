// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import VCS from '../../sync/vcs';
import { showError } from './modals';

type Props = {
  vcs: VCS,
  branch: string,
  onPull: Function,
  disabled?: boolean,
  className?: string,
  children?: React.Node,
};

type State = {
  loading: boolean,
};

@autobind
class SyncPullButton extends React.PureComponent<Props, State> {
  _timeout: TimeoutID;
  state = {
    loading: false,
  };

  async _handleClick() {
    const { vcs, onPull, branch } = this.props;

    this.setState({ loading: true });
    const newVCS = vcs.newInstance();
    const oldBranch = await newVCS.getBranch();

    let failed = false;
    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      await newVCS.checkout([], branch);
      await newVCS.pull([]);
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
      this.setState({ loading: false });
    }, 400);

    if (!failed) {
      onPull && onPull();
    }
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillUnmount() {
    clearTimeout(this._timeout);
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
