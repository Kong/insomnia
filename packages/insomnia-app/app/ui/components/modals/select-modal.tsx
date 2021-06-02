import React, { createRef, PureComponent } from 'react';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

export interface SelectModalShowOptions {
  message: string | null;
  onCancel?: () => void;
  onDone?: (selectedValue: string | null) => Promise<void>;
  options: {
    name: string;
    value: string;
  }[];
  title: string | null;
  value: string | null;
}

const initialState: SelectModalShowOptions = {
  message: null,
  options: [],
  title: null,
  value: null,
};

export class SelectModal extends PureComponent<{}, SelectModalShowOptions> {
  modal = createRef<Modal>();
  doneButton = createRef<HTMLButtonElement>();
  state: SelectModalShowOptions = initialState;

  #onDone = async () => {
    this.hide();
    await this.state.onDone?.(this.state.value);
  }

  #handleSelectChange = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    this.setState({ value: event.currentTarget.value });
  }

  hide = () => {
    this.modal.current?.hide();
  }

  show = ({
    message,
    onCancel,
    onDone,
    options,
    title,
    value,
  }: SelectModalShowOptions = initialState) => {
    this.setState({
      message,
      onCancel,
      onDone,
      options,
      title,
      value,
    });
    this.modal.current?.show();
    setTimeout(() => {
      this.doneButton.current?.focus();
    }, 100);
  }

  render() {
    const { message, title, options, value, onCancel } = this.state;
    return (
      <Modal ref={this.modal} onCancel={onCancel}>
        <ModalHeader>{title || 'Confirm?'}</ModalHeader>
        <ModalBody className="wide pad">
          <p>{message}</p>
          <div className="form-control form-control--outlined">
            <select onChange={this.#handleSelectChange} value={value ?? undefined}>
              {options.map(({ name, value }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </ModalBody>
        <ModalFooter>
          <button ref={this.doneButton} className="btn" onClick={this.#onDone}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}
