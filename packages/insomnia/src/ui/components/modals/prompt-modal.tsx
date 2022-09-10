import classnames from 'classnames';
import React, { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from 'react';

import { Button } from '../base/button';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
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
  onDeleteHint?: ((arg0?: string) => void) | null;
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
  onDeleteHint?: (arg0?: string) => void;
  onCancel?: () => void;
}
export interface PromptModalHandle {
  show: (options: PromptModalOptions) => void;
  hide: () => void;
}
export const PromptModal = forwardRef<PromptModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<Modal>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State>({
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
  });
  const _done = async (rawValue?: string) => {
    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const value = state.upperCase ? rawValue!.toUpperCase() : rawValue;
    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await state.onComplete?.(value!);
    modalRef.current?.hide();
  };
  const _handleSubmit = async (event: React.SyntheticEvent<HTMLFormElement | HTMLButtonElement>) => {
    if (state.loading) {
      return;
    }

    setState({ ...state, loading: true });

    event.preventDefault();

    if (inputRef.current) {
      const result = inputRef.current.type === 'checkbox' ? inputRef.current.checked.toString() : inputRef.current.value;

      await _done(result);
    }

    setState({ ...state, loading: false });
  };
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({
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
    }) => {
      setState({
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
      modalRef.current?.show();
    },
  }), []);

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
  } = state;
  const input = (
    <input
      ref={inputRef}
      onChange={event => {
        if (state.validate) {
          const errorMessage = state.validate(event.currentTarget.value);
          event.currentTarget.setCustomValidity(errorMessage);
        }
      }}
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
    sanitizedHints = hints.slice(0, 15).map(hint =>
      (<div key={hint} className="btn btn--outlined btn--super-duper-compact margin-right-sm margin-top-sm inline-block">
        <Button className="tall" onClick={() => _done(hint)}>
          {hint}
        </Button>
        <PromptButton
          addIcon
          confirmMessage=""
          className="tall space-left icon"
          onClick={() => {
            state.onDeleteHint?.(hint);
            const hints = state.hints.filter(h => h !== hint);
            setState({
              ...state,
              hints,
            });
          }}
          value={hint}
        >
          <i className="fa fa-close faint" />
        </PromptButton>
      </div>));
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
    <Modal
      ref={modalRef}
      noEscape={!cancelable || loading}
      onCancel={() => {
        if (state.loading) {
          return;
        }
        state.onCancel?.();
      }}
      onHide={state.onHide}
    >
      <ModalHeader>{title}</ModalHeader>
      <ModalBody className="wide">
        <form onSubmit={_handleSubmit} className="wide pad">
          <div className={divClassnames}>{field}</div>
          {sanitizedHints}
        </form>
      </ModalBody>
      <ModalFooter>
        <div className="margin-left faint italic txt-sm">{hint ? `* ${hint}` : ''}</div>
        <button className="btn" onClick={_handleSubmit} disabled={loading}>
          {loading && <i className="fa fa-refresh fa-spin" />} {submitName || 'Submit'}
        </button>
      </ModalFooter>
    </Modal>
  );
});
PromptModal.displayName = 'PromptModal';
