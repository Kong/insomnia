// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

type Props = {};

type State = {
  title: string,
  options: Array<{ name: string, value: string }>,
  value: string,
  message: string
};

@autobind
class SelectModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  doneButton: ?HTMLButtonElement;
  _doneCallback: ?Function;

  constructor(props: Props) {
    super(props);

    this.state = {
      title: '',
      options: [],
      message: '',
      value: ''
    };
  }

  _setModalRef(m: ?Modal) {
    this.modal = m;
  }

  _setDoneButtonRef(n: ?HTMLButtonElement) {
    this.doneButton = n;
  }

  _handleDone() {
    this.hide();
    this._doneCallback && this._doneCallback(this.state.value);
  }

  _handleSelectChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ value: e.currentTarget.value });
  }

  hide() {
    this.modal && this.modal.hide();
  }

  show(data: Object = {}) {
    const { title, message, options, value, onDone } = data;

    this._doneCallback = onDone;

    this.setState({ title, message, options, value });

    this.modal && this.modal.show();
    setTimeout(() => {
      this.doneButton && this.doneButton.focus();
    }, 100);
  }

  render() {
    const { message, title, options, value } = this.state;

    return (
      <Modal noEscape ref={this._setModalRef}>
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
          <button
            ref={this._setDoneButtonRef}
            className="btn"
            onClick={this._handleDone}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default SelectModal;
