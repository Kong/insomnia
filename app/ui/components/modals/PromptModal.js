import React, {Component} from 'react';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

class PromptModal extends Component {
  state = {
    headerName: 'Not Set',
    defaultValue: '',
    submitName: 'Not Set',
    selectText: false,
    hint: null,
    inputType: 'text'
  };

  _handleSubmit = e => {
    e.preventDefault();

    this._onSubmitCallback && this._onSubmitCallback(this._input.value);
    this.modal.hide();
  };

  _handleCancel = e => this.modal.hide();

  show ({headerName, defaultValue, submitName, selectText, hint, inputType, placeholder, label}) {
    this.modal.show();

    this._input.value = defaultValue || '';

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.focus();
      selectText && this._input.select();
    }, 100);

    return new Promise(resolve => {
      this._onSubmitCallback = resolve;

      this.setState({
        headerName,
        defaultValue,
        submitName,
        selectText,
        placeholder,
        hint,
        inputType,
        label,
      })
    });
  }

  render () {
    const {extraProps} = this.props;
    const {submitName, headerName, hint, inputType, placeholder, label} = this.state;

    return (
      <Modal ref={m => this.modal = m} {...extraProps}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._handleSubmit} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              {label ? (
                <label htmlFor="prompt-input" className="label--small">
                  {label}
                </label>
              ) : null}
              <input
                ref={n => this._input = n}
                id="prompt-input"
                type={inputType === 'decimal' ? 'number' : (inputType || 'text')}
                step={inputType === 'decimal' ? '0.1' : null}
                min={inputType === 'decimal' ? '0.5' : null}
                placeholder={placeholder || ''}
              />
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">{hint ? `* ${hint}` : ''}</div>
          <div>
            <button className="btn" onClick={this._handleCancel}>
              Cancel
            </button>
            <button className="btn" onClick={this._handleSubmit}>
              {submitName || 'Submit'}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    )
  }
}

PromptModal.propTypes = {};

export default PromptModal;
