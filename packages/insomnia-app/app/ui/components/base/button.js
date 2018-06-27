import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';

@autobind
class Button extends PureComponent {
  _handleClick(e) {
    const { onClick, onDisabledClick, disabled } = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      fn && fn(this.props.value, e);
    } else {
      fn && fn(e);
    }
  }

  render() {
    const { children, disabled, tabIndex, className, type, id } = this.props;

    return (
      <button
        disabled={disabled}
        id={id}
        type={type}
        tabIndex={tabIndex}
        className={className}
        onClick={this._handleClick}>
        {children}
      </button>
    );
  }
}

Button.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  value: PropTypes.any,
  className: PropTypes.string,
  onDisabledClick: PropTypes.func,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  tabIndex: PropTypes.number,
  type: PropTypes.string,
  id: PropTypes.string
};

export default Button;
