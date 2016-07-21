import React, {Component, PropTypes} from 'react';

class Input extends Component {
  _valueChanged () {
    if (!this.props.onChange) {
      return;
    }

    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      const value = this.refs.input.value;
      const checked = this.refs.input.checked;

      if (this.props.type === 'number') {
        if (value === '') {
          // This is what it returns when not a valid number
          return;
        }
        this.props.onChange(parseFloat(value));
      } else if (this.props.type === 'checkbox') {
        this.props.onChange(checked);
      } else {
        this.props.onChange(value);
      }
    }, 100);
  }

  _updateValueFromProps () {
    if (this.props.type === 'number') {
      this.refs.input.value = this.props.value || 0;
    } else if (this.props.type === 'checkbox') {
      this.refs.input.checked = this.props.value || false;
    } else {
      this.refs.input.value = this.props.value || '';
    }

    if (this.props.autofocus) {
      this.focus();
    }
  }

  componentDidMount () {
    this._updateValueFromProps()
  }

  componentDidUpdate () {
    this._updateValueFromProps();
  }

  shouldComponentUpdate (nextProps) {
    // Only update when we have to, or else the cursor will jump to the end.
    return this.refs.input.value !== nextProps.value;
  }

  focus () {
    this.refs.input.focus();
  }

  getValue () {
    return this.refs.input.value;
  }

  render () {
    // NOTE: We're taking props base <input> doesn't need
    const {value, autofocus, ...other} = this.props;
    return (
      <input
        {...other}
        ref="input"
        onChange={this._valueChanged.bind(this)}
      />
    )
  }
}

Input.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
    PropTypes.bool
  ]),
  autofocus: PropTypes.bool
};

export default Input;
