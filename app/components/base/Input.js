import React, {Component, PropTypes} from 'react';

class Input extends Component {
  _valueChanged (e) {
    if (!this.props.onChange) {
      return;
    }

    if (this.props.type === 'number') {
      if (e.target.value === '') {
        // This is what it returns when not a valid number
        return;
      }
      this.props.onChange(parseFloat(e.target.value));
    } else if (this.props.type === 'checkbox') {
      this.props.onChange(e.target.checked);
    } else {
      this.props.onChange(e.target.value);
    }
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
