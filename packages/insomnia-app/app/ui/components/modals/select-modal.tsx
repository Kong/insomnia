import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { showModal } from '.';

export interface SelectModalShowOptions {
  message: string | null;
  onCancel?: () => void;
  onDone?: (selectedValue: string | null) => void | Promise<void>;
  options: {
    name: string;
    value: string;
  }[];
  title: string | null;
  value: string | null;
  noEscape?: boolean;
}

const initialState: SelectModalShowOptions = {
  message: null,
  options: [],
  title: null,
  value: null,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
export class SelectModal extends PureComponent<{}, SelectModalShowOptions> {
  modal = createRef<Modal>();
  doneButton = createRef<HTMLButtonElement>();
  state: SelectModalShowOptions = initialState;

  async _onDone() {
    this.modal.current?.hide();
    await this.state.onDone?.(this.state.value);
  }

  _handleSelectChange(event: React.SyntheticEvent<HTMLSelectElement>) {
    this.setState({ value: event.currentTarget.value });
  }

  show({
    message,
    onCancel,
    onDone,
    options,
    title,
    value,
    noEscape,
  }: SelectModalShowOptions = initialState) {
    this.setState({
      message,
      onCancel,
      onDone,
      options,
      title,
      value,
      noEscape,
    });
    this.modal.current?.show();
    setTimeout(() => {
      this.doneButton.current?.focus();
    }, 100);
  }

  render() {
    const { message, title, options, value, onCancel, noEscape } = this.state;

    return (
      <Modal ref={this.modal} onCancel={onCancel} noEscape={noEscape}>
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
          <button ref={this.doneButton} className="btn" onClick={this._onDone}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export const showSelectModal = (opts: SelectModalShowOptions) => showModal(SelectModal, opts);
