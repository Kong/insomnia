import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { strings } from '../../../common/strings';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { RootState } from '../../redux/modules';
import { selectActiveWorkspace } from '../../redux/selectors';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { Button } from '../themed-button';

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends ReduxProps {
  vcs: VCS;
}

interface State {
  error: string;
  workspaceName: string;
}

const INITIAL_STATE: State = {
  error: '',
  workspaceName: '',
};

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedSyncDeleteModal extends PureComponent<Props, State> {
  modal: ModalHandle | null = null;
  input: HTMLInputElement | null = null;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
  }

  _setModalRef(modal: ModalHandle) {
    this.modal = modal;
  }

  _setInputRef(input: HTMLInputElement) {
    this.input = input;
  }

  _updateWorkspaceName(event: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      workspaceName: event.currentTarget.value,
    });
  }

  async _handleDelete(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const { vcs } = this.props;
    const { workspaceName } = this.state;

    try {
      await interceptAccessError({
        action: 'delete',
        callback: () => vcs.archiveProject(),
        resourceName: workspaceName,
        resourceType: strings.collection.singular.toLowerCase(),
      });
      this.hide();
    } catch (err) {
      this.setState({
        error: err.message,
      });
    }
  }

  async show() {
    this.modal && this.modal.show();
    // Reset state
    this.setState(INITIAL_STATE);
    // Focus input when modal shows
    setTimeout(() => {
      this.input?.focus();
    }, 100);
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { error, workspaceName } = this.state;
    const { activeWorkspace } = this.props;
    const workspaceNameElement = (
      <strong
        style={{
          whiteSpace: 'pre-wrap',
        }}
      >
        {activeWorkspace?.name}
      </strong>
    );
    return (
      <Modal ref={this._setModalRef} skinny>
        <ModalHeader>Delete {strings.collection.singular}</ModalHeader>
        <ModalBody className="wide pad-left pad-right text-center" noScroll>
          {error && <p className="notice error margin-bottom-sm no-margin-top">{error}</p>}
          <p className="selectable">
            This will permanently delete the {workspaceNameElement}{' '}
            {strings.collection.singular.toLowerCase()} remotely.
          </p>
          <p className="selectable">Please type {workspaceNameElement} to confirm.</p>

          <form onSubmit={this._handleDelete}>
            <div className="form-control form-control--outlined">
              <input
                ref={this._setInputRef}
                type="text"
                onChange={this._updateWorkspaceName}
                value={workspaceName}
              />
              <Button bg="danger" disabled={workspaceName !== activeWorkspace?.name}>
                Delete {strings.collection.singular}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  activeWorkspace: selectActiveWorkspace(state),
});

export const SyncDeleteModal = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
)(UnconnectedSyncDeleteModal);
