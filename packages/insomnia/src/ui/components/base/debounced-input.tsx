import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { forwardRef, PureComponent, useImperativeHandle, useRef } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { debounce } from '../../../common/misc';

interface Props {
  onChange: (value: string) => void;
  onFocus?: (event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  delay?: number;
  placeholder?: string;
  initialValue?: string;
}

export interface DebouncedInputHandle extends HTMLInputElement {
  focusEnd: () => void;
}

const DebouncedInput = forwardRef<HTMLInputElement, Props>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { onChange,  delay, ...rest } = props;
  const toDebounceOrNotToDebounce = delay ? debounce(onChange, delay || 500) : onChange;

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    focusEnd: () => {
      if (inputRef.current) {
        inputRef.current.value = inputRef.current.value;
        inputRef.current.focus();
      }
    },
    setAttribute: (name: string, value: string) => {
      inputRef.current?.setAttribute(name, value);
    },
    removeAttribute: (name: string) => {
      inputRef.current?.removeAttribute(name);
    },
    getAttribute: (name: string) => {
      return inputRef.current?.getAttribute(name) || null;
    },
    hasFocus: () => {
      return document.activeElement === inputRef.current;
    },
    getSelectionStart: () => {
      return inputRef.current?.selectionStart;
    },
    getSelectionEnd: () => {
      return inputRef.current?.selectionEnd;
    },
    blur: () => {
      inputRef.current?.blur();
    },
    select: () => {
      inputRef.current?.select();
    },
    getValue: () => {
      return inputRef.current?.value;
    },
    setValue: (value: string) => {
      if (inputRef.current) {
        inputRef.current.value = value;
      }
    },
  }), []);

  return (
    <input
      ref={inputRef}
      {...rest}
      onChange={e => toDebounceOrNotToDebounce(e.target.value)}
    />
  );
});
DebouncedInput.displayName = 'DebouncedInput';
