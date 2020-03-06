import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class AskModal extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      title: '',
      message: '',
      yesText: 'Yes',
      noText: 'No',
      loading: false,
    };
  }

  _setModalRef(m) {
    this.modal = m;
  }

  _setYesButtonRef(n) {
    this.yesButton = n;
  }

  async _handleYes() {
    this.setState({ loading: true });

    if (this._doneCallback) {
      // Wait for the callback to finish before closing
      await this._doneCallback(true);
    }

    this._promiseCallback(true);

    this.hide();
  }

  _handleNo() {
    this.hide();
    this._doneCallback && this._doneCallback(false);
    this._promiseCallback(false);
  }

  hide() {
    this.modal.hide();
  }

  show(options = {}) {
    const { title, message, onDone, yesText, noText } = options;

    this._doneCallback = onDone;

    this.setState({
      title: title || 'Confirm',
      message: message || 'No message provided',
      yesText: yesText || 'Yes',
      noText: noText || 'No',
      loading: false,
    });

    this.modal.show();

    setTimeout(() => {
      this.yesButton && this.yesButton.focus();
    }, 100);

    return new Promise(resolve => {
      this._promiseCallback = resolve;
    });
  }

  render() {
    const { message, title, yesText, noText, loading } = this.state;

    return (
      <Modal noEscape ref={this._setModalRef} closeOnKeyCodes={[13]}>
        <ModalHeader>{title || 'Confirm?'}</ModalHeader>
        <ModalBody className="wide pad">{message}</ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this._handleNo}>
              {noText}
            </button>
            <button
              ref={this._setYesButtonRef}
              className="btn"
              onClick={this._handleYes}
              disabled={loading}>
              {loading && <i className="fa fa-refresh fa-spin" />} {yesText}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default AskModal;
