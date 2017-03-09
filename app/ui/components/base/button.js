import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';

@autobind
class Button extends PureComponent {
  _handleClick (e) {
    const {onClick, onDisabledClick, disabled} = this.props;
    const fn = disabled ? onDisabledClick : onClick;

    if (this.props.hasOwnProperty('value')) {
      fn && fn(this.props.value, e);
    } else {
      fn && fn(e);
    }
  }

  render () {
    const {
      children,
      disabled,
      tabIndex
    } = this.props;

    return (
      <button disabled={disabled}
              tabIndex={tabIndex}
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
  onDisabledClick: PropTypes.func,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  tabIndex: PropTypes.number
};

export default Button;
