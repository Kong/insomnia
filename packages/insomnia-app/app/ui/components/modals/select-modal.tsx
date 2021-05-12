import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

interface State {
  title: string;
  options: Array<{
    name: string;
    value: string;
  }>;
  value: string;
  message: string;
  onCancel?: (...args: Array<any>) => any;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SelectModal extends PureComponent<{}, State> {
  modal: Modal | null = null;
  doneButton: HTMLButtonElement | null = null;
  _doneCallback: ((...args: Array<any>) => any) | null = null;

  state: State = {
    title: '',
    options: [],
    message: '',
    value: '',
  }

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  _setDoneButtonRef(n: HTMLButtonElement) {
    this.doneButton = n;
  }

  _handleDone() {
    this.hide();
    this._doneCallback && this._doneCallback(this.state.value);
  }

  _handleSelectChange(e: React.SyntheticEvent<HTMLSelectElement>) {
    this.setState({
      value: e.currentTarget.value,
    });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  show(data: Record<string, any> = {}) {
    const { title, message, options, value, onDone, onCancel } = data;
    this._doneCallback = onDone;
    this.setState({
      title,
      message,
      options,
      value,
      onCancel,
    });
    this.modal && this.modal.show();
    setTimeout(() => {
      this.doneButton && this.doneButton.focus();
    }, 100);
  }

  render() {
    const { message, title, options, value, onCancel } = this.state;
    return (
      <Modal ref={this._setModalRef} onCancel={onCancel}>
        <ModalHeader>{title || 'Confirm?'}</ModalHeader>
        <ModalBody className="wide pad">
          <p>{message}</p>
          <div className="form-control form-control--outlined">
            <select onChange={this._handleSelectChange} value={value}>
              {options.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <button ref={this._setDoneButtonRef} className="btn" onClick={this._handleDone}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SelectModal;
