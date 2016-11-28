import React, {Component} from 'react';
import classnames from 'classnames';
import CopyButton from '../base/CopyButton';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as sync from '../../../sync';
import PromptButton from '../base/PromptButton';

class WorkspaceSettingsModal extends Component {
  state = {
    workspace: null
  };

  _handleSetModalRef = n => this.modal = n;

  toggle (workspace) {
    this.modal.toggle();
    this.setState({workspace});
  }

  show (workspace) {
    this.modal.show();
    this.setState({workspace});
  }

  hide () {
    this.modal.hide();
  }

  renderModalBody (workspace) {
    return (
      <ModalBody className="pad">
        <PromptButton onClick={this._handleWorkspaceRemove}
                      addIcon={true}
                      className="pull-right btn btn--clicky">
          <i className="fa fa-trash-o"/> Delete <strong>{workspace.name}</strong>
        </PromptButton>
      </ModalBody>
    )
  }

  renderModalHeader (workspace) {
    return (
      <ModalHeader>
        {workspace.name} Configuration
      </ModalHeader>
    )
  }

  render () {
    const {workspace} = this.state;
    return (
      <Modal ref={this._handleSetModalRef} tall={true}>
        {workspace ? this.renderModalHeader(workspace) : null}
        {workspace ? this.renderModalBody(workspace) : null}
      </Modal>
    )
  }
}

WorkspaceSettingsModal.propTypes = {};

export default WorkspaceSettingsModal;
