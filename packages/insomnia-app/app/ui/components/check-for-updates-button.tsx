import { autoBindMethodsForReact } from 'class-autobind-decorator';
import * as electron from 'electron';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  children: ReactNode;
  className?: string | null;
}

interface State {
  status: string;
  checking: boolean;
  updateAvailable: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class CheckForUpdatesButton extends PureComponent<Props, State> {
  state: State = {
    status: '',
    checking: false,
    updateAvailable: false,
  };

  _listenerCheckComplete(_e, updateAvailable: true, status: string) {
    this.setState({
      status,
      updateAvailable,
    });
  }

  _listenerCheckStatus(_e, status: string) {
    if (this.state.checking) {
      this.setState({
        status,
      });
    }
  }

  _handleCheckForUpdates() {
    electron.ipcRenderer.send('updater.check');
    this.setState({ checking: true });
  }

  componentDidMount() {
    electron.ipcRenderer.on('updater.check.status', this._listenerCheckStatus);
    electron.ipcRenderer.on('updater.check.complete', this._listenerCheckComplete);
  }

  componentWillUnmount() {
    electron.ipcRenderer.removeListener('updater.check.complete', this._listenerCheckComplete);
    electron.ipcRenderer.removeListener('updater.check.status', this._listenerCheckStatus);
  }

  render() {
    const { children, className } = this.props;
    const { status, checking } = this.state;
    return (
      <button
        className={className ?? ''}
        disabled={checking}
        onClick={this._handleCheckForUpdates}
      >
        {status || children}
      </button>
    );
  }
}

export default CheckForUpdatesButton;
