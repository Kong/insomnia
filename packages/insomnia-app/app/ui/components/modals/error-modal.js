// @flow

import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

export type ErrorModalOptions = {|
  title?: string,
  error?: Error,
  addCancel?: boolean,
  message?: string,
|};

@autobind
class ErrorModal extends PureComponent<{}, ErrorModalOptions> {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
      error: null,
      message: '',
      addCancel: false,
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

  show(options: ErrorModalOptions = {}) {
    const { title, error, addCancel, message } = options;
    this.setState({ title, error, addCancel, message });

    this.modal.show();

    console.log('[ErrorModal]', error);

    return new Promise(resolve => {
      this._okCallback = resolve;
    });
  }

  render() {
    const { error, title, addCancel } = this.state;

    const message = this.state.message || error?.message;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>{title || 'Uh Oh!'}</ModalHeader>
        <ModalBody className="wide pad">
          {message ? <div className="notice error pre">{message}</div> : null}
          {error && (
            <details>
              <summary>Stack trace</summary>
              <pre className="pad-top-sm force-wrap selectable">
                <code className="wide">{error.stack || error}</code>
              </pre>
            </details>
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
