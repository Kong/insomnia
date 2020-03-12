// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import Button from '../base/button';
import PromptButton from '../base/prompt-button';

type Props = {};

type State = {
  title: string,
  hints: Array<string>,
  defaultValue: ?string,
  submitName: ?string,
  selectText: ?boolean,
  upperCase: ?boolean,
  validate: ?(string) => string,
  hint: ?string,
  label: ?string,
  placeholder: ?string,
  inputType: ?string,
  cancelable: ?boolean,
  onComplete: ?(string) => void,
  onCancel: ?() => void,
  onDeleteHint: ?(string) => void,
  currentValue: string,
};

@autobind
class PromptModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _input: ?HTMLInputElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      title: 'Not Set',
      hints: [],
      defaultValue: '',
      submitName: '',
      selectText: false,
      upperCase: false,
      validate: null,
      hint: '',
      label: '',
      placeholder: '',
      inputType: '',
      cancelable: false,
      onComplete: undefined,
      onCancel: undefined,
      onDeleteHint: undefined,
      currentValue: '',
    };
  }

  _done(rawValue: string) {
    const { onComplete, upperCase } = this.state;
    const value = upperCase ? rawValue.toUpperCase() : rawValue;
    onComplete && onComplete(value);
    this.hide();
  }

  _setInputRef(n: ?HTMLInputElement) {
    this._input = n;
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _handleSelectHint(hint: string) {
    this._done(hint);
  }

  _handleDeleteHint(hint: string) {
    const { onDeleteHint } = this.state;
    onDeleteHint && onDeleteHint(hint);
    const hints = this.state.hints.filter(h => h !== hint);
    this.setState({ hints });
  }

  _handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();

    if (this._input) {
      const result =
        this._input.type === 'checkbox' ? this._input.checked.toString() : this._input.value;
      this._done(result);
    }
  }

  _handleChange(e: SyntheticEvent<HTMLInputElement>) {
    const { validate } = this.state;

    if (validate) {
      const errorMessage = validate(e.currentTarget.value);
      e.currentTarget.setCustomValidity(errorMessage);
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  show(options: {
    title: string,
    defaultValue?: string,
    submitName?: string,
    selectText?: boolean,
    upperCase?: boolean,
    hint?: string,
    cancelable?: boolean,
    inputType?: string,
    placeholder?: string,
    validate?: string => string,
    label?: string,
    hints?: Array<string>,
    onComplete?: string => void,
    onDeleteHint?: string => void,
    onCancel?: () => void,
  }) {
    const {
      title,
      defaultValue,
      submitName,
      selectText,
      upperCase,
      hint,
      cancelable,
      inputType,
      placeholder,
      label,
      hints,
      onComplete,
      onCancel,
      validate,
      onDeleteHint,
    } = options;

    this.setState({
      currentValue: '',
      title,
      onCancel,
      onDeleteHint,
      onComplete,
      defaultValue,
      submitName,
      selectText,
      cancelable: cancelable === undefined ? true : cancelable,
      placeholder,
      upperCase,
      hint,
      inputType,
      label,
      validate,
      hints: hints || [],
    });

    this.modal && this.modal.show();

    // Need to do this after render because modal focuses itself too
    setTimeout(() => {
      if (!this._input) {
        return;
      }
      if (inputType === 'checkbox') {
        this._input.checked = !!defaultValue;
      } else {
        this._input.value = defaultValue || '';
      }
      this._input.focus();
      selectText && this._input && this._input.select();
    }, 100);
  }

  _renderHintButton(hint: string) {
    const classes = classnames(
      'btn btn--outlined btn--super-duper-compact',
      'margin-right-sm margin-top-sm inline-block',
    );

    return (
      <div key={hint} className={classes}>
        <Button className="tall" onClick={this._handleSelectHint} value={hint}>
          {hint}
        </Button>
        <PromptButton
          addIcon
          confirmMessage=""
          className="tall space-left icon"
          onClick={this._handleDeleteHint}
          value={hint}>
          <i className="fa fa-close faint" />
        </PromptButton>
      </div>
    );
  }

  render() {
    const {
      submitName,
      title,
      hint,
      inputType,
      placeholder,
      label,
      upperCase,
      hints,
      cancelable,
      onCancel,
    } = this.state;

    const input = (
      <input
        ref={this._setInputRef}
        onChange={this._handleChange}
        id="prompt-input"
        type={inputType === 'decimal' ? 'number' : inputType || 'text'}
        step={inputType === 'decimal' ? '0.1' : null}
        min={inputType === 'decimal' ? '0.5' : null}
        style={{ textTransform: upperCase ? 'uppercase' : 'none' }}
        placeholder={placeholder || ''}
      />
    );

    let sanitizedHints = [];
    if (Array.isArray(hints)) {
      sanitizedHints = hints.slice(0, 15).map(this._renderHintButton);
    }

    let field = input;
    if (label) {
      const labelClasses = classnames({
        'inline-block': inputType === 'checkbox',
      });
      field = (
        <label htmlFor="prompt-input" className={labelClasses}>
          {label} {input}
        </label>
      );
    }

    const divClassnames = classnames('form-control form-control--wide', {
      'form-control--outlined': inputType !== 'checkbox',
    });
    return (
      <Modal ref={this._setModalRef} noEscape={!cancelable} onCancel={onCancel}>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._handleSubmit} className="wide pad">
            <div className={divClassnames}>{field}</div>
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

export default PromptModal;
