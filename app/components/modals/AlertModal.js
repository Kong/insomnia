import React from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import ModalComponent from '../lib/ModalComponent';

class AlertModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {};
  }

  show ({headerName, message}) {
    super.show();

    this.setState({headerName, message});

    Mousetrap.bindGlobal('enter', () => this.hide());
  }

  render () {
    const {extraProps} = this.props;
    const {message, headerName} = this.state;

    return (
      <Modal ref="modal" {...extraProps}>
        <ModalHeader>{headerName || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">
          {message}
        </ModalBody>
        <ModalFooter>
          <button className="btn pull-right" onClick={e => this.hide()}>
            Ok
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

AlertModal.propTypes = {};

export default AlertModal;
