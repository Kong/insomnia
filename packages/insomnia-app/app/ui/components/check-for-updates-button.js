// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import * as electron from 'electron';

type Props = {
  children: React.Node,
  className: ?string
};

type State = {
  status: string,
  checking: boolean,
  updateAvailable: boolean
};

@autobind
class CheckForUpdatesButton extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      status: '',
      checking: false,
      updateAvailable: false
    };
  }

  _listenerCheckComplete(e: any, updateAvailable: true, status: string) {
    this.setState({ status, updateAvailable });
  }

  _listenerCheckStatus(e: any, status: string) {
    if (this.state.checking) {
      this.setState({ status });
    }
  }

  _handleCheckForUpdates() {
    electron.ipcRenderer.send('updater.check');
    this.setState({ checking: true });
  }

  componentDidMount() {
    electron.ipcRenderer.on('updater.check.status', this._listenerCheckStatus);
    electron.ipcRenderer.on(
      'updater.check.complete',
      this._listenerCheckComplete
    );
  }

  componentWillUnmount() {
    electron.ipcRenderer.removeListener(
      'updater.check.complete',
      this._listenerCheckComplete
    );
    electron.ipcRenderer.removeListener(
      'updater.check.status',
      this._listenerCheckStatus
    );
  }

  render() {
    const { children, className } = this.props;
    const { status, checking } = this.state;

    return (
      <button
        className={className}
        disabled={checking}
        onClick={this._handleCheckForUpdates}>
        {status || children}
      </button>
    );
  }
}

export default CheckForUpdatesButton;
