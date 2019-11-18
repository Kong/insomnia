import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class AlertModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
      message: '',
      addCancel: false,
      okLabel: '',
    };
  }

  _setModalRef(m) {
    this.modal = m;
  }

  _handleOk() {
    this.hide();
    this._okCallback();

    if (typeof this._okCallback2 === 'function') {
      this._okCallback2();
    }
  }

  hide() {
    this.modal.hide();
  }

  setCancelRef(n) {
    this._cancel = n;
  }

  setOkRef(n) {
    this._ok = n;
  }

  show(options = {}) {
    const { title, message, addCancel, onConfirm, okLabel } = options;
    this.setState({ title, message, addCancel, okLabel });

    this.modal && this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._cancel && this._cancel.focus();
    }, 100);

    this._okCallback2 = onConfirm;

    return new Promise(resolve => {
      this._okCallback = resolve;
    });
  }

  render() {
    const { message, title, addCancel, okLabel } = this.state;

    return (
      <Modal ref={this._setModalRef} closeOnKeyCodes={[13]} skinny>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">{message}</ModalBody>
        <ModalFooter>
          <div>
            {addCancel ? (
              <button className="btn" ref={this.setCancelRef} onClick={this.hide}>
                Cancel
              </button>
            ) : null}
            <button className="btn" ref={this.setOkRef} onClick={this._handleOk}>
              {okLabel || 'Ok'}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default AlertModal;
