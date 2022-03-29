import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

export interface ErrorModalOptions {
  title?: string;
  error?: Error | null;
  addCancel?: boolean;
  message?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ErrorModal extends PureComponent<{}, ErrorModalOptions> {
  modal: Modal | null = null;
  _okCallback: (value?: unknown) => void = () => {};

  state: ErrorModalOptions = {
    title: '',
    error: null,
    message: '',
    addCancel: false,
  };

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  _handleOk() {
    this.hide();

    this._okCallback();
  }

  hide() {
    this.modal?.hide();
  }

  show(options: ErrorModalOptions = {}) {
    const { title, error, addCancel, message } = options;
    this.setState({
      title,
      error,
      addCancel,
      message,
    });

    this.modal?.show();

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
