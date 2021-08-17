import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Button } from 'insomnia-components';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { strings } from '../../../common/strings';
import type { Workspace } from '../../../models/workspace';
import { interceptAccessError } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';

interface Props {
  workspace: Workspace;
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
class SyncDeleteModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  input: HTMLInputElement | null = null;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
  }

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setInputRef(m: HTMLInputElement) {
    this.input = m;
  }

  _updateWorkspaceName(e: React.SyntheticEvent<HTMLInputElement>) {
    this.setState({
      workspaceName: e.currentTarget.value,
    });
  }

  async _handleDelete(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
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

  async show(options: { onHide: (...args: any[]) => any }) {
    this.modal &&
      this.modal.show({
        onHide: options.onHide,
      });
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
    const { workspace } = this.props;
    const workspaceNameElement = (
      <strong
        style={{
          whiteSpace: 'pre-wrap',
        }}
      >
        {workspace.name}
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
              <Button bg="danger" disabled={workspaceName !== workspace.name}>
                Delete {strings.collection.singular}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    );
  }
}

export default SyncDeleteModal;
