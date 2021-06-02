import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

export interface SelectModalShowOptions {
  title: string | null;
  message: string | null;
  options: {
    name: string;
    value: string;
  }[];
  value: string | null;
  onDone?: (selectedValue: string | null) => Promise<void>;
  onCancel?: () => void;
}

type State = Omit<SelectModalShowOptions, 'onDone'>;

const initialState: State = {
  title: null,
  options: [],
  message: null,
  value: null,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
export class SelectModal extends PureComponent<{}, State> {
  modal: Modal | null = null;
  doneButton: HTMLButtonElement | null = null;
  onDone: SelectModalShowOptions['onDone'] | null = null;

  state: State = initialState;

  _setModalRef(m: Modal) {
    this.modal = m;
  }

  _setDoneButtonRef(n: HTMLButtonElement) {
    this.doneButton = n;
  }

  _handleDone = async () => {
    this.hide();
    await this.onDone?.(this.state.value);
  }

  _handleSelectChange(e: React.SyntheticEvent<HTMLSelectElement>) {
    this.setState({
      value: e.currentTarget.value,
    });
  }

  hide() {
    this.modal?.hide();
  }

  show({
    title,
    message,
    options,
    value,
    onDone,
    onCancel,
  }: SelectModalShowOptions = initialState) {
    this.onDone = onDone;
    this.setState({
      title,
      message,
      options,
      value,
      onCancel,
    });
    this.modal?.show();
    setTimeout(() => {
      this.doneButton?.focus();
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
            <select onChange={this._handleSelectChange} value={value ?? undefined}>
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
