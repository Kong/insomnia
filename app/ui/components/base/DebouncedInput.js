import React, {PureComponent, PropTypes} from 'react';
import {debounce} from '../../../common/misc';

class DebouncedInput extends PureComponent {
  constructor (props) {
    super(props);

    if (!props.delay) {
      this._handleValueChange = props.onChange;
    } else {
      this._handleValueChange = debounce(props.onChange, props.delay || 500);
    }
  }

  _handleChange = e => this._handleValueChange(e.target.value);
  _setRef = n => this._input = n;

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
    if (this._input) {
      // Hack to focus the end (set value to current value);
      this._input.value = this.getValue();
    }
  }

  blur () {
    if (this._input) {
      this._input.blur();
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
    // NOTE: Strip out onChange because we're overriding it
    const {onChange, delay, textarea, ...props} = this.props;
    if (textarea) {
      return (
        <textarea ref={this._setRef} {...props} onChange={this._handleChange}/>
      )
    } else {
      return (
        <input ref={this._setRef} {...props} onChange={this._handleChange}/>
      )
    }
  }
}

DebouncedInput.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,

  // Optional
  textarea: PropTypes.bool,
  delay: PropTypes.number,
};

export default DebouncedInput;
