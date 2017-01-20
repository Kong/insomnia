import React, {Component, PropTypes} from 'react';
import {shell} from 'electron';

class Button extends Component {
  _handleClick = e => {
    const {onClick, disabled} = this.props;

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, e);
    } else {
      onClick(e);
    }
  };

  render () {
    const {children, value, ...props} = this.props;
    return (
      <button {...props} onClick={this._handleClick}>{children}</button>
    )
  }
}

Button.propTypes = {
  value: PropTypes.any,
};

export default Button;
