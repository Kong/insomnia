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
    // Only force update if the uniqueness key has changed
    return !this.props.uniquenessKey || this.props.uniquenessKey !== nextProps.uniquenessKey;
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

Input.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
  uniquenessKey: PropTypes.string
};

export default Input;
