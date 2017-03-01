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

  selectionStart () {
    return this._input ? this._input.selectionStart : -1;
  }

  focus () {
    this._input && this._input.focus();
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
