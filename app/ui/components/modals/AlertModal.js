import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class AlertModal extends Component {
  state = {
    title: '',
    message: '',
  };

  _handleOk = () => {
    this.hide();
    this._okCallback();
  };

  hide () {
    this.modal.hide();
  }

  show (options = {}) {
    this.modal.show();

    const {title, message} = options;
    this.setState({title, message});

    return new Promise(resolve => this._okCallback = resolve);
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
          <button className="btn" onClick={this._handleOk}>
            Ok
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

AlertModal.propTypes = {};

export default AlertModal;
