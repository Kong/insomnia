import React, {Component, PropTypes} from 'react';
import {Cookie} from 'tough-cookie';


class CookieInput extends Component {
  constructor (props) {
    super(props);
    this.state = {
      isValid: true
    };
  }

  _handleChange () {
    const isValid = this._isValid();

    if (isValid) {
      this.props.onChange(this._input.value);
    }

    this.setState({isValid})
  }

  _isValid () {
    try {
      const cookie = Cookie.parse(this._input.value);
      return !!(cookie && cookie.domain);
    } catch (e) {
      return false;
    }
  }

  render () {
    const {defaultValue} = this.props;
    const {isValid} = this.state;

    return (
      <input
        className={isValid ? '' : 'input--error'}
        ref={n => this._input = n}
        type="text"
        defaultValue={defaultValue}
        onChange={e => this._handleChange(e.target.value)}
      />
    );
  }
}

CookieInput.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default CookieInput;
