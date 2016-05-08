import React, {Component, PropTypes} from 'react';

class Input extends Component {
  _valueChanged (e) {
    if (!this.props.onChange) {
      return;
    }

    this.props.onChange(e.target.value);
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

  shouldComponentUpdate (nextProps) {
    return this.refs.input.value !== nextProps.value;
  }

  focus () {
    this.refs.input.focus();
  }
  
  getValue () {
    return this.refs.input.value;
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

Input.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired
};

export default Input;
