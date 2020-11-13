// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import * as models from '../../../models';
import HelpTooltip from '../help-tooltip';

type Props = {
  workspaces: Array<Workspace>,
};

type State = {
  requestGroup: RequestGroup | null,
  selectedWorkspaceId: string | null,
};

@autobind
class MoveRequestGroupModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);

    this.state = {
      requestGroup: null,
      selectedWorkspaceId: null,
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  async _handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { requestGroup, selectedWorkspaceId } = this.state;
    if (!requestGroup || !selectedWorkspaceId) {
      return;
    }

    const workspace = await models.workspace.getById(selectedWorkspaceId);
    if (!workspace) {
      return;
    }

    // TODO: if there are gRPC requests in a request group
    //  we should also copy the protofiles to the destination workspace - INS-267

    await models.requestGroup.duplicate(requestGroup, {
      metaSortKey: -1e9,
      parentId: selectedWorkspaceId,
      name: requestGroup.name, // Because duplicating will add (Copy) suffix
    });

    await models.requestGroup.remove(requestGroup);
    this.hide();
  }

  _handleChangeSelectedWorkspace(e: SyntheticEvent<HTMLSelectElement>) {
    const selectedWorkspaceId = e.currentTarget.value;
    this.setState({ selectedWorkspaceId });
  }

  show(options: { requestGroup: RequestGroup }) {
    const { requestGroup } = options;
    this.setState({ requestGroup });
    this.modal && this.modal.show();
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { workspaces } = this.props;
    const { selectedWorkspaceId } = this.state;
    return (
      <form onSubmit={this._handleSubmit}>
        <Modal ref={this._setModalRef} {...(this.props: Object)}>
          <ModalHeader key="header">Move Folder to Workspace</ModalHeader>
          <ModalBody key="body" className="pad">
            <div className="form-control form-control--outlined">
              <label>
                New Workspace&nbsp;
                <HelpTooltip>Folder will be moved to the root of the new workspace</HelpTooltip>
                <select onChange={this._handleChangeSelectedWorkspace} value={selectedWorkspaceId}>
                  <option value="n/a">-- Select Workspace --</option>
                  {workspaces.map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </ModalBody>
          <ModalFooter key="footer">
            <button type="submit" className="btn">
              Move
            </button>
          </ModalFooter>
        </Modal>
      </form>
    );
  }
}

export default MoveRequestGroupModal;
