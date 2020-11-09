// @flow

import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { Workspace } from '../../../models/workspace';
import VCS from '../../../sync/vcs';
import { Button } from 'insomnia-components';

type Props = {
  workspace: Workspace,
  vcs: VCS,
};

type State = {
  error: string,
  workspaceName: string,
};

const INITIAL_STATE: State = {
  error: '',
  workspaceName: '',
};

@autobind
class SyncDeleteModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  input: ?HTMLInputElement;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _setInputRef(m: ?HTMLInputElement) {
    this.input = m;
  }

  _updateWorkspaceName(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ workspaceName: e.currentTarget.value });
  }

  async _handleDelete(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    const { vcs } = this.props;

    try {
      await vcs.archiveProject();
      this.hide();
    } catch (err) {
      this.setState({
        error: err.message,
      });
    }
  }

  async show(options: { onHide: Function }) {
    this.modal && this.modal.show({ onHide: options.onHide });

    // Reset state
    this.setState(INITIAL_STATE);

    // Focus input when modal shows
    setTimeout(() => {
      this.input && this.input.focus();
    }, 100);
  }

  hide() {
    this.modal && this.modal.hide();
  }

  render() {
    const { error, workspaceName } = this.state;
    const { workspace } = this.props;

    return (
      <Modal ref={this._setModalRef} skinny>
        <ModalHeader>Delete Workspace</ModalHeader>
        <ModalBody className="wide pad-left pad-right text-center" noScroll>
          {error && <p className="notice error margin-bottom-sm no-margin-top">{error}</p>}
          <p className="selectable">
            This will permanently delete the{' '}
            <strong style={{ whiteSpace: 'pre-wrap' }}>{workspace.name}</strong> workspace remotely.
          </p>
          <p className="selectable">
            Please type <strong style={{ whiteSpace: 'pre-wrap' }}>{workspace.name}</strong> to
            confirm.
          </p>

          <form onSubmit={this._handleDelete}>
            <div className="form-control form-control--outlined">
              <input
                ref={this._setInputRef}
                type="text"
                onChange={this._updateWorkspaceName}
                value={workspaceName}
              />
              <Button bg="danger" disabled={workspaceName !== workspace.name}>
                Delete Workspace
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncDeleteModal;
