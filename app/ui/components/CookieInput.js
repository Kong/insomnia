import React, {PureComponent, PropTypes} from 'react';
import autoBind from 'react-autobind';
import {Cookie} from 'tough-cookie';

class CookieInput extends PureComponent {
  constructor (props) {
    super(props);

    this.state = {
      isValid: true,
    };

    autoBind(this);
  }

  _setInputRef (n) {
    this._input = n;
  }

  _handleChange (e) {
    const isValid = this._isValid();

    if (isValid) {
      const value = e.target.value;
      this.props.onChange(value);
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
        ref={this._setInputRef}
        type="text"
        defaultValue={defaultValue}
        onChange={this._handleChange}
      />
    );
  }
}

CookieInput.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default CookieInput;
