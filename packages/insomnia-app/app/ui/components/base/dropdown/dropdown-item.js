import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import classnames from 'classnames';

@autobind
class DropdownItem extends PureComponent {
  _handleClick(e) {
    const { stayOpenAfterClick, onClick, disabled } = this.props;

    if (stayOpenAfterClick) {
      e.stopPropagation();
    }

    if (!onClick || disabled) {
      return;
    }

    if (this.props.hasOwnProperty('value')) {
      onClick(this.props.value, e);
    } else {
      onClick(e);
    }
  }

  render() {
    const {
      buttonClass,
      children,
      className,
      color,
      onClick, // eslint-disable-line no-unused-vars
      stayOpenAfterClick, // eslint-disable-line no-unused-vars
      ...props
    } = this.props;

    const styles = color ? { color } : {};

    const inner = (
      <div className={classnames('dropdown__inner', className)}>
        <div className="dropdown__text" style={styles}>
          {children}
        </div>
      </div>
    );

    const buttonProps = {
      type: 'button',
      onClick: this._handleClick,
      ...props
    };

    return React.createElement(buttonClass || 'button', buttonProps, inner);
  }
}

DropdownItem.propTypes = {
  buttonClass: PropTypes.any,
  stayOpenAfterClick: PropTypes.bool,
  value: PropTypes.any,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  children: PropTypes.node,
  className: PropTypes.string,
  color: PropTypes.string
};

export default DropdownItem;
