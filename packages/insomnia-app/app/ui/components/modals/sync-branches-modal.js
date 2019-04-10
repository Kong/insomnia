// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import PromptButton from '../base/prompt-button';
import HelpTooltip from '../help-tooltip';
import VCS from '../../../sync/vcs';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type State = {
  branches: Array<string>,
};

@autobind
class SyncBranchesModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);
    this.state = {
      branches: [],
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  async refreshState(newState?: Object) {
    const { vcs } = this.props;
    const branches = await vcs.getBranches();

    this.setState({
      branches,
      ...newState,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  async show() {
    this.modal && this.modal.show();
    await this.refreshState();
  }

  render() {
    const { branches } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Branches</ModalHeader>
        <ModalBody className="wide pad">
          <table className="table--fancy table--striped">
            <thead>
              <tr>
                <th className="text-left">Name</th>
                <th className="text-left">Status</th>
                <th className="text-right">Thing</th>
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
              {branches.map(name => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>Up to date</td>
                  <td className="text-right">Bar</td>
                  <td className="text-right">
                    <PromptButton className="btn btn--micro btn--outlined">Test</PromptButton>
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

export default SyncBranchesModal;
