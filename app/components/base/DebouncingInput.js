import React, {Component, PropTypes} from 'react';

const DEFAULT_DEBOUNCE_MILLIS = 300;

/**
 * Input that only fire onChange() after the user stops typing
 */
class DebouncingInput extends Component {
  valueChanged (e) {
    if (!this.props.onChange) {
      return;
    }

    // Surround in closure because callback may change before debounce
    clearTimeout(this._timeout);
    ((value, cb, debounceMillis = DEFAULT_DEBOUNCE_MILLIS) => {
      this._timeout = setTimeout(() => cb(value), debounceMillis);
    })(e.target.value, this.props.onChange, this.props.debounceMillis);
  }

  updateValueFromProps() {
    this.refs.input.value = this.props.initialValue || this.props.value || '';
  }

  componentDidMount () {
    this.updateValueFromProps()
  }
  
  componentDidUpdate () {
    this.updateValueFromProps()
  }

  render () {
    const {initialValue, value} = this.props;
    return (
      <input
        ref="input"
        type="text"
        className={this.props.className}
        initialValue={initialValue || value}
        onChange={this.valueChanged.bind(this)}
        placeholder={this.props.placeholder}
      />
    )
  }
}

DebouncingInput.propTypes = {
  onChange: PropTypes.func.isRequired,
  initialValue: PropTypes.string,
  debounceMillis: PropTypes.number,
  value: PropTypes.string
};

export default DebouncingInput;
