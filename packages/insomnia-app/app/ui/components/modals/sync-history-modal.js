// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import { VCS } from 'insomnia-sync';
import type { Workspace } from '../../../models/workspace';
import TimeFromNow from '../time-from-now';
import * as syncTypes from 'insomnia-sync/src/types';
import Tooltip from '../tooltip';

type Props = {
  workspace: Workspace,
};

type State = {
  branch: string,
  history: Array<syncTypes.Snapshot>,
};

@autobind
class SyncHistoryModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  vcs: VCS;

  constructor(props: Props) {
    super(props);
    this.state = {
      branch: '',
      history: [],
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _handleDone() {
    this.hide();
  }

  async refreshState(newState?: Object) {
    const branch = await this.vcs.getBranch();
    const history = await this.vcs.getHistory();

    this.setState({
      branch,
      history: history.sort((a, b) => (a.created < b.created ? 1 : -1)),
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { vcs: VCS }) {
    this.vcs = options.vcs;
    this.modal && this.modal.show();
    await this.refreshState();
  }

  render() {
    const { branch, history } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>
          Branch History: <i>{branch}</i>
        </ModalHeader>
        <ModalBody className="wide pad">
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Message</th>
                <th className="text-left">Time</th>
                <th className="text-right">Objects</th>
              </tr>
            </thead>
            <tbody>
              {history.map(snapshot => (
                <tr key={snapshot.id}>
                  <td>
                    {snapshot.name}{' '}
                    <Tooltip message={snapshot.id} selectable position="right" wide>
                      <i className="fa fa-info-circle" />
                    </Tooltip>
                  </td>
                  <td>
                    <TimeFromNow timestamp={snapshot.created} intervalSeconds={30} />
                  </td>
                  <td className="text-right">{snapshot.state.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncHistoryModal;
