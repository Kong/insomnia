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
  checking: boolean
};

@autobind
class CheckForUpdatesButton extends React.PureComponent<Props, State> {
  constructor (props: Props) {
    super(props);
    this.state = {
      status: '',
      checking: false
    };
  }

  componentDidMount () {
    electron.ipcRenderer.on('updater.check.status', (e, status) => {
      if (this.state.checking) {
        this.setState({status});
      }
    });

    electron.ipcRenderer.on('updater.check.complete', () => {
      this.setState({checking: false, status: ''});
    });
  }

  _handleCheckForUpdates () {
    electron.ipcRenderer.send('updater.check');
    this.setState({checking: true});
  }

  render () {
    const {children, className} = this.props;
    const {status, checking} = this.state;
    return (
      <button disabled={status}
              className={className}
              onClick={this._handleCheckForUpdates}>
        {(checking && status) ? status : children}
      </button>
    );
  }
}

export default CheckForUpdatesButton;
