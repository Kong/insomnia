import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Button from '../base/button';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';

@autobind
class PromptModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      headerName: 'Not Set',
      defaultValue: '',
      submitName: 'Not Set',
      selectText: false,
      upperCase: false,
      hint: null,
      inputType: 'text',
      hints: []
    };
  }

  _done (rawValue) {
    const value = this.state.upperCase ? rawValue.toUpperCase() : rawValue;
    this._onSubmitCallback && this._onSubmitCallback(value);
    this._onSubmitCallback2 && this._onSubmitCallback2(value);
    this.hide();
  }

  _setInputRef (n) {
    this._input = n;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _handleSelectHint (hint) {
    this._done(hint);
  }

  _handleSubmit (e) {
    e.preventDefault();

    this._done(this._input.value);
  }

  hide () {
    this.modal.hide();
  }

  show (options) {
    const {
      headerName,
      defaultValue,
      submitName,
      selectText,
      upperCase,
      hint,
      inputType,
      placeholder,
      label,
      hints,
      onComplete
    } = options;

    this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      this._input.value = defaultValue || '';
      this._input.focus();
      selectText && this._input.select();
    }, 100);

    return new Promise(resolve => {
      this._onSubmitCallback = resolve;
      this._onSubmitCallback2 = onComplete;

      this.setState({
        headerName,
        defaultValue,
        submitName,
        selectText,
        placeholder,
        upperCase,
        hint,
        inputType,
        label,
        hints
      });
    });
  }

  _renderHintButton (hint) {
    return (
      <Button type="button"
              value={hint}
              key={hint}
              className="btn btn--outlined btn--super-duper-compact margin-right-sm margin-top-sm"
              onClick={this._handleSelectHint}>
        {hint}
      </Button>
    );
  }

  render () {
    const {
      submitName,
      headerName,
      hint,
      inputType,
      placeholder,
      label,
      upperCase,
      hints
    } = this.state;

    const input = (
      <input
        ref={this._setInputRef}
        id="prompt-input"
        type={inputType === 'decimal' ? 'number' : (inputType || 'text')}
        step={inputType === 'decimal' ? '0.1' : null}
        min={inputType === 'decimal' ? '0.5' : null}
        style={{textTransform: upperCase ? 'uppercase' : 'none'}}
        placeholder={placeholder || ''}
      />
    );

    let sanitizedHints = [];
    if (Array.isArray(hints)) {
      sanitizedHints = hints.slice(0, 15).map(this._renderHintButton);
    }

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>{headerName}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._handleSubmit} className="wide pad">
            <div className="form-control form-control--outlined form-control--wide">
              {label ? <label>{label}{input}</label> : input}
            </div>
            {sanitizedHints}
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">{hint ? `* ${hint}` : ''}</div>
          <button className="btn" onClick={this._handleSubmit}>
            {submitName || 'Submit'}
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

PromptModal.propTypes = {};

export default PromptModal;
