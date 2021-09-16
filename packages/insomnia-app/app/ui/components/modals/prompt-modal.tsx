import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import Button from '../base/button';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import PromptButton from '../base/prompt-button';

interface State {
  title: string;
  hints: string[];
  defaultValue?: string | null;
  submitName?: string | null;
  selectText?: boolean | null;
  upperCase?: boolean | null;
  validate?: ((arg0: string) => string) | null;
  hint?: string | null;
  label?: string | null;
  placeholder?: string | null;
  inputType?: string | null;
  cancelable?: boolean | null;
  onComplete?: (arg0: string) => Promise<void> | void;
  onCancel?: (() => void) | null;
  onHide?: () => void;
  onDeleteHint?: ((arg0: string) => void) | null;
  currentValue: string;
  loading: boolean;
}

export interface PromptModalOptions {
  title: string;
  defaultValue?: string;
  submitName?: string;
  selectText?: boolean;
  upperCase?: boolean;
  hint?: string;
  cancelable?: boolean;
  inputType?: string;
  placeholder?: string;
  validate?: (arg0: string) => string;
  label?: string;
  hints?: string[];
  onComplete?: (arg0: string) => Promise<void> | void;
  onHide?: () => void;
  onDeleteHint?: (arg0: string) => void;
  onCancel?: () => void;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class PromptModal extends PureComponent<{}, State> {
  modal: Modal | null = null;
  _input: HTMLInputElement | null = null;

  state: State = {
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
    onHide: undefined,
    currentValue: '',
    loading: false,
  };

  async _done(rawValue: string) {
    const { onComplete, upperCase } = this.state;
    const value = upperCase ? rawValue.toUpperCase() : rawValue;
    await onComplete?.(value);
    this.hide();
  }

  _handleCancel() {
    const { onCancel, loading } = this.state;
    if (loading) {
      return;
    }

    onCancel?.();
  }

  _setInputRef(n: HTMLInputElement) {
    this._input = n;
  }

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _handleSelectHint(hint: string) {
    this._done(hint);
  }

  _handleDeleteHint(hint: string) {
    const { onDeleteHint } = this.state;
    onDeleteHint?.(hint);
    const hints = this.state.hints.filter(h => h !== hint);
    this.setState({
      hints,
    });
  }

  async _handleSubmit(e: React.SyntheticEvent<HTMLFormElement | HTMLButtonElement>) {
    if (this.state.loading) {
      return;
    }

    this.setState({
      loading: true,
    });

    e.preventDefault();

    if (this._input) {
      const result =
        this._input.type === 'checkbox' ? this._input.checked.toString() : this._input.value;

      await this._done(result);
    }

    this.setState({
      loading: false,
    });
  }

  _handleChange(e: React.SyntheticEvent<HTMLInputElement>) {
    const { validate } = this.state;

    if (validate) {
      const errorMessage = validate(e.currentTarget.value);
      e.currentTarget.setCustomValidity(errorMessage);
    }
  }

  hide() {
    this.modal?.hide();
  }

  show({
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
    onHide,
  }: PromptModalOptions) {
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
      loading: false,
      onHide,
    });
    this.modal?.show();

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

      selectText && this._input?.select();
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
          value={hint}
        >
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
      loading,
    } = this.state;
    const input = (
      <input
        ref={this._setInputRef}
        onChange={this._handleChange}
        id="prompt-input"
        disabled={loading}
        type={inputType === 'decimal' ? 'number' : inputType || 'text'}
        step={inputType === 'decimal' ? '0.1' : undefined}
        min={inputType === 'decimal' ? '0.5' : undefined}
        style={{
          textTransform: upperCase ? 'uppercase' : 'none',
        }}
        placeholder={placeholder || ''}
      />
    );
    let sanitizedHints: ReactNode[] = [];

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
      <Modal ref={this._setModalRef} noEscape={!cancelable || loading} onCancel={this._handleCancel} onHide={this.state.onHide}>
        <ModalHeader>{title}</ModalHeader>
        <ModalBody className="wide">
          <form onSubmit={this._handleSubmit} className="wide pad">
            <div className={divClassnames}>{field}</div>
            {sanitizedHints}
          </form>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm">{hint ? `* ${hint}` : ''}</div>
          <button className="btn" onClick={this._handleSubmit} disabled={loading}>
            {loading && <i className="fa fa-refresh fa-spin" />} {submitName || 'Submit'}
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default PromptModal;
