import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

export interface AlertModalOptions {
  title?: string;
  message?: ReactNode;
  addCancel?: boolean;
  okLabel?: string;
  onConfirm?: () => void | Promise<void>;
}

type State = Omit<AlertModalOptions, 'onConfirm'>;

@autoBindMethodsForReact(AUTOBIND_CFG)
export class AlertModal extends PureComponent<{}, State> {
  state: State = {
    title: '',
    message: '',
    addCancel: false,
    okLabel: '',
  };

  modal: ModalHandle | null = null;
  _cancel: HTMLButtonElement | null = null;
  _ok: HTMLButtonElement | null = null;

  _okCallback?: (value: void | PromiseLike<void>) => void;
  _okCallback2: AlertModalOptions['onConfirm'];

  _setModalRef(modal: ModalHandle) {
    this.modal = modal;
  }

  _handleOk() {
    this.hide();

    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this._okCallback!();

    if (typeof this._okCallback2 === 'function') {
      this._okCallback2();
    }
  }

  hide() {
    this.modal?.hide();
  }

  setCancelRef(cancel: HTMLButtonElement) {
    this._cancel = cancel;
  }

  setOkRef(ok: HTMLButtonElement) {
    this._ok = ok;
  }

  show({ title, message, addCancel, onConfirm, okLabel }: AlertModalOptions) {
    this.setState({
      title,
      message,
      addCancel,
      okLabel,
    });
    this.modal?.show();
    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._cancel?.focus();
    }, 100);
    this._okCallback2 = onConfirm;
    return new Promise<void>(resolve => {
      this._okCallback = resolve;
    });
  }

  render() {
    const { message, title, addCancel, okLabel } = this.state;
    return (
      <Modal ref={this._setModalRef} skinny>
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
