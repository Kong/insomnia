// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {debounce} from '../../../common/misc';

type Props = {
  onChange: (value: string) => mixed,
  onFocus?: (e: SyntheticFocusEvent<HTMLTextAreaElement | HTMLInputElement>) => mixed,
  onBlur?: (e: SyntheticFocusEvent<HTMLTextAreaElement | HTMLInputElement>) => mixed,
  textarea?: boolean,
  delay?: number
}

@autobind
class DebouncedInput extends React.PureComponent<Props> {
  _handleValueChange: (value: string) => mixed;
  _hasFocus: boolean;
  _input: null | HTMLInputElement | HTMLTextAreaElement

  constructor (props: Props) {
    super(props);

    if (!props.delay) {
      this._handleValueChange = props.onChange;
    } else {
      this._handleValueChange = debounce(props.onChange, props.delay || 500);
    }

    this._hasFocus = false;
  }

  _handleChange (e: SyntheticKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._handleValueChange(e.currentTarget.value);
  }

  _handleFocus (e: SyntheticFocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = true;
    this.props.onFocus && this.props.onFocus(e);
  }

  _handleBlur (e: SyntheticFocusEvent<HTMLTextAreaElement | HTMLInputElement>) {
    this._hasFocus = false;
    this.props.onBlur && this.props.onBlur(e);
  }

  _setRef (n: null | HTMLInputElement | HTMLTextAreaElement) {
    this._input = n;
  }

  setAttribute (name: string, value: string) {
    if (this._input) this._input.setAttribute(name, value);
  }

  removeAttribute (name: string) {
    if (this._input) this._input.removeAttribute(name);
  }

  getAttribute (name: string) {
    if (this._input) this._input.getAttribute(name);
  }

  hasFocus () {
    return this._hasFocus;
  }

  getSelectionStart () {
    if (this._input) {
      return this._input.selectionStart;
    } else {
      return -1;
    }
  }

  getSelectionEnd () {
    if (this._input) {
      return this._input.selectionEnd;
    } else {
      return -1;
    }
  }

  focus () {
    if (this._input) {
      this._input.focus();
    }
  }

  focusEnd () {
    const {_input} = this;
    if (_input) {
      // Hack to focus the end (set value to current value);
      _input.value = this.getValue();
      _input.focus();
    }
  }

  blur () {
    if (this._input) {
      this._input.blur();
    }
  }

  select () {
    if (this._input) {
      this._input.select();
    }
  }

  getValue () {
    if (this._input) {
      return this._input.value;
    } else {
      return '';
    }
  }

  render () {
    const {
      onChange, // eslint-disable-line no-unused-vars
      onFocus, // eslint-disable-line no-unused-vars
      onBlur, // eslint-disable-line no-unused-vars
      delay, // eslint-disable-line no-unused-vars
      textarea,
      ...props
    } = this.props;
    if (textarea) {
      return (
        <textarea
          ref={this._setRef}
          {...props}
          onChange={this._handleChange}
          onFocus={this._handleFocus}
          onBlur={this._handleBlur}
        />
      );
    } else {
      return (
        <input
          ref={this._setRef}
          {...props}
          onChange={this._handleChange}
          onFocus={this._handleFocus}
          onBlur={this._handleBlur}
        />
      );
    }
  }
}

DebouncedInput.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,

  // Optional
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  textarea: PropTypes.bool,
  delay: PropTypes.number
};

export default DebouncedInput;
