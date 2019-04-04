// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import { VCS } from 'insomnia-sync';
import type { Workspace } from '../../../models/workspace';
import TimeFromNow from '../time-from-now';
import Tooltip from '../tooltip';
import type { Snapshot } from 'insomnia-sync/src/types';
import PromptButton from '../base/prompt-button';
import HelpTooltip from '../help-tooltip';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type State = {
  branch: string,
  history: Array<Snapshot>,
};

@autobind
class SyncHistoryModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  handleRollback: Snapshot => Promise<void>;

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

  async _handleClickRollback(snapshot: Snapshot) {
    await this.handleRollback(snapshot);
    await this.refreshState();
  }

  async refreshState(newState?: Object) {
    const { vcs } = this.props;
    const branch = await vcs.getBranch();
    const history = await vcs.getHistory();

    this.setState({
      branch,
      history: history.sort((a, b) => (a.created < b.created ? 1 : -1)),
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show(options: { vcs: VCS, handleRollback: Snapshot => Promise<void> }) {
    this.modal && this.modal.show();
    this.handleRollback = options.handleRollback;
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
                <th className="text-right">
                  Rollback
                  <HelpTooltip>
                    Rolling back will clear any unsynced changes and update the local app data to
                    match the desired snapshot. This operation leaves modifications in an un-synced
                    state, as if you had made the modifications manually.
                  </HelpTooltip>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.map(snapshot => (
                <tr key={snapshot.id}>
                  <td>
                    <Tooltip message={snapshot.id} selectable wide delay={500}>
                      {snapshot.name}{' '}
                    </Tooltip>
                  </td>
                  <td>
                    <TimeFromNow timestamp={snapshot.created} intervalSeconds={30} />
                  </td>
                  <td className="text-right">{snapshot.state.length}</td>
                  <td className="text-right">
                    <PromptButton
                      className="btn btn--micro btn--outlined"
                      onClick={() => this._handleClickRollback(snapshot)}>
                      Rollback
                    </PromptButton>
                  </td>
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
