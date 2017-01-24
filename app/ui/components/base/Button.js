import React, {Component, PropTypes} from 'react';
import {shell} from 'electron';

class Button extends Component {
  _handleClick = e => {
    const {onClick, onDisabledClick, disabled} = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      fn && fn(this.props.value, e);
    } else {
      fn && fn(e);
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
  onDisabledClick: PropTypes.func,
  onClick: PropTypes.func,
};

export default Button;
