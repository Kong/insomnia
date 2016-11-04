import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class AlertModal extends Component {
  constructor (props) {
    super(props);
    this.state = {};
  }

  show ({title, message}) {
    this.modal.show();
    this.setState({title, message});
  }

  render () {
    const {extraProps} = this.props;
    const {message, title} = this.state;

    return (
      <Modal ref={m => this.modal = m} closeOnKeyCodes={[13]} {...extraProps}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">
          {message}
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={e => this.modal.hide()}>
            Ok
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

AlertModal.propTypes = {};

export default AlertModal;
