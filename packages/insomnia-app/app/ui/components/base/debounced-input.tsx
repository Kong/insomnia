import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { debounce } from '../../../common/misc';

interface Props {
  onChange: (value: string) => void;
  onFocus?: Function;
  onBlur?: Function;
  textarea?: boolean;
  delay?: number;
  placeholder?: string;
  initialValue?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class DebouncedInput extends PureComponent<Props> {
  _hasFocus = false;
  _input: HTMLTextAreaElement | HTMLInputElement | null = null;
  _handleValueChange: Props['onChange'] | null = null;

  constructor(props: Props) {
    super(props);

    if (!props.delay) {
      this._handleValueChange = props.onChange;
    } else {
      this._handleValueChange = debounce(props.onChange, props.delay || 500);
    }
  }

  componentDidMount() {
    if (this._input && this.props.initialValue) {
      this._input.value = this.props.initialValue;
    }
  }

  _handleChange(e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._handleValueChange?.(e.target.value);
  }

  _handleFocus(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = true;
    this.props.onFocus?.(e);
  }

  _handleBlur(e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = false;
    this.props.onBlur?.(e);
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
    if (this._input) {
      this._input.focus();
    }
  }

  focusEnd() {
    if (this._input) {
      // Hack to focus the end (set value to current value);
      this._input.value = this.getValue();

      this._input.focus();
    }
  }

  blur() {
    if (this._input) {
      this._input.blur();
    }
  }

  select() {
    if (this._input) {
      this._input.select();
    }
  }

  getValue() {
    if (this._input) {
      return this._input.value;
    } else {
      return '';
    }
  }

  setValue(value: string) {
    if (this._input) {
      this._input.value = value;
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

export default DebouncedInput;
