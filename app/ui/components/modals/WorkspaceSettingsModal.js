import React, {Component} from 'react';
import classnames from 'classnames';
import CopyButton from '../base/CopyButton';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as sync from '../../../sync';

class WorkspaceSettingsModal extends Component {
  state = {
    workspace: null
  };

  _handleSetModalRef = n => this.modal = n;

  show ({workspace}) {
    this.modal.show();
    this.setState({
      workspace
    });
  }

  hide () {
    this.modal.hide();
  }

  renderBody () {
    const {workspace} = this.state;
    if (!workspace) {
      return null;
    }

    return (
      <h2>Welcome!</h2>
    )
  }

  render () {
    const {workspace} = this.state;
    return (
      <Modal ref={this._handleSetModalRef} tall={true}>
        <ModalHeader>{workspace ? workspace.name : ''} Configuration</ModalHeader>
        <ModalBody className="pad selectable txt-sm monospace">
          {this.renderBody()}
        </ModalBody>
      </Modal>
    )
  }
}

WorkspaceSettingsModal.propTypes = {};

export default WorkspaceSettingsModal;
