import React, {Component, PropTypes} from 'react';

const DEFAULT_DEBOUNCE_MILLIS = 300;

/**
 * Input that only fire onChange() after the user stops typing
 */
class DebouncingInput extends Component {
  _valueChanged (e) {
    if (!this.props.onChange) {
      return;
    }

    // Surround in closure because callback may change before debounce
    clearTimeout(this._timeout);
    ((value, cb, debounceMillis = DEFAULT_DEBOUNCE_MILLIS) => {
      this._timeout = setTimeout(() => cb(value), debounceMillis);
    })(e.target.value, this.props.onChange, this.props.debounceMillis);
  }

  _updateValueFromProps () {
    this.refs.input.value = this.props.initialValue || this.props.value || '';
  }

  componentDidMount () {
    this._updateValueFromProps()
  }

  componentDidUpdate () {
    this._updateValueFromProps()
  }

  focus () {
    this.refs.input.focus();
  }

  render () {
    const {value, ...other} = this.props;
    return (
      <input
        {...other}
        ref="input"
        onChange={this._valueChanged.bind(this)}
      />
    )
  }
}

DebouncingInput.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  debounceMillis: PropTypes.number
};

export default DebouncingInput;
