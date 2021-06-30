import React, { ChangeEvent, InputHTMLAttributes, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import { debounce } from '../../../common/misc';

type TargetElement = HTMLTextAreaElement | HTMLInputElement;

interface ExtendedAttributes {
  onChange: (value?: string) => void;
}

type InheritedAttributes = Omit<InputHTMLAttributes<TargetElement>, keyof ExtendedAttributes>

interface Props extends InheritedAttributes, ExtendedAttributes {
  textarea?: boolean;
  delay?: number;
}

interface State {
  delay: number;
  onChange: ExtendedAttributes['onChange'];
  debouncedOnChange: ExtendedAttributes['onChange'];
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class DebouncedInput extends PureComponent<Props, State> {
  _hasFocus = false;
  _input: HTMLTextAreaElement | HTMLInputElement | null = null;

  state: State = {
    delay: this.props.delay ?? 500,
    onChange: this.props.onChange,
    debouncedOnChange: debounce(this.props.onChange, this.props.delay),
  }

  static getDerivedStateFromProps(props: Props, state: State) {
    if (state.delay !== props.delay || state.onChange !== props.onChange) {
      return {
        onChange: props.onChange,
        debouncedOnChange: debounce(props.onChange, props.delay),
        delay: props.delay,
      };
    }
    return null;
  }

  _handleChange(event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    const { delay } = this.props;
    const { onChange, debouncedOnChange } = this.state;
    const { value } = event.target;
    if (!delay) {
      onChange(value);
    } else {
      debouncedOnChange(value);
    }
  }

  _handleFocus(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = true;
    this.props.onFocus && this.props.onFocus(e);
  }

  _handleBlur(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = false;
    this.props.onBlur && this.props.onBlur(e);
  }

  _setRef(n: HTMLTextAreaElement | HTMLInputElement) {
    this._input = n;
  }

  setAttribute(name: string, value: string) {
    this._input?.setAttribute(name, value);
  }

  removeAttribute(name: string) {
    this._input?.removeAttribute(name);
  }

  getAttribute(name: string) {
    this._input?.getAttribute(name);
  }

  hasFocus() {
    return this._hasFocus;
  }

  getSelectionStart() {
    if (this._input) {
      return this._input.selectionStart;
    } else {
      return -1;
    }
  }

  getSelectionEnd() {
    if (this._input) {
      return this._input.selectionEnd;
    } else {
      return -1;
    }
  }

  focus() {
    this._input?.focus();
  }

  focusEnd() {
    if (this._input) {
      // Hack to focus the end (set value to current value);
      this._input.value = this.getValue();
    }
    this._input?.focus();
  }

  blur() {
    this._input?.blur();
  }

  select() {
    this._input?.select();
  }

  getValue() {
    if (this._input) {
      return this._input.value;
    } else {
      return '';
    }
  }

  render() {
    const {
      onChange,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      onFocus,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      onBlur,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      delay,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      textarea,
      ...props
    } = this.props;

    if (textarea) {
      return (
        <textarea
          ref={ref => { this._input = ref; }}
          {...props}
          onChange={this._handleChange}
          onFocus={this._handleFocus}
          onBlur={this._handleBlur}
        />
      );
    } else {
      return (
        <input
          ref={ref => { this._input = ref; }}
          {...props}
          onChange={this._handleChange}
          onFocus={this._handleFocus}
          onBlur={this._handleBlur}
        />
      );
    }
  }
}
