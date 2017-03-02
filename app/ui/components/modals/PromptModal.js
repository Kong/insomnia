import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';

@autobind
class PromptModal extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      headerName: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      selectText: false,
      hint: null,
      inputType: 'text'
    };
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _handleSubmit (e) {
    e.preventDefault();

    this._onSubmitCallback && this._onSubmitCallback(this._input.value);
    this.modal.hide();
  }

  show ({headerName, defaultValue, submitName, selectText, hint, inputType, placeholder, label}) {
    this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.value = defaultValue || '';
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

    const input = (
      <input
        ref={n => this._input = n}
        id="prompt-input"
        type={inputType === 'decimal' ? 'number' : (inputType || 'text')}
        step={inputType === 'decimal' ? '0.1' : null}
        min={inputType === 'decimal' ? '0.5' : null}
        placeholder={placeholder || ''}
      />
    );

    return (
      <Modal ref={this._setModalRef} {...extraProps}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._handleSubmit} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              {label ? <label>{label}{input}</label> : input}
            </div>
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">{hint ? `* ${hint}` : ''}</div>
          <button className="btn" onClick={this._handleSubmit}>
            {submitName || 'Submit'}
          </button>
        </ModalFooter>
      </Modal>
    )
  }
}

PromptModal.propTypes = {};

export default PromptModal;
