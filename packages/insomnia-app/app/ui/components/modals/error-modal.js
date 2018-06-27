import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class ErrorModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
      error: null,
      message: '',
      addCancel: false
    };
  }

  _setModalRef(m) {
    this.modal = m;
  }

  _handleOk() {
    this.hide();
    this._okCallback();
  }

  hide() {
    this.modal.hide();
  }

  show(options = {}) {
    const { title, error, addCancel, message } = options;
    this.setState({ title, error, addCancel, message });

    this.modal.show();

    return new Promise(resolve => {
      this._okCallback = resolve;
    });
  }

  render() {
    const { error, message, title, addCancel } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">
          {message ? <div className="notice error">{message}</div> : null}
          {error && (
            <pre className="pad-top-sm force-wrap selectable">
              <code>{error.stack}</code>
            </pre>
          )}
        </ModalBody>
        <ModalFooter>
          <div>
            {addCancel ? (
              <button className="btn" onClick={this.hide}>
                Cancel
              </button>
            ) : null}
            <button className="btn" onClick={this._handleOk}>
              Ok
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default ErrorModal;
