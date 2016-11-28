import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';

class DropdownItem extends PureComponent {
  _handleClick = e => {
    const {stayOpenAfterClick, onClick, disabled} = this.props;

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
  };

  render () {
    const {
      buttonClass,
      children,
      className,
      onClick, // Don't want this in ...props
      stayOpenAfterClick, // Don't want this in ...props
      ...props
    } = this.props;

    const inner = (
      <div className={classnames('dropdown__inner', className)}>
        <span className="dropdown__text">{children}</span>
      </div>
    );

    const buttonProps = {
      type: 'button',
      onClick: this._handleClick,
      ...props
    };

    const button = React.createElement(buttonClass || 'button', buttonProps, inner);
    return (
      <li>{button}</li>
    )
  }
}

DropdownItem.propTypes = {
  buttonClass: PropTypes.any,
  stayOpenAfterClick: PropTypes.bool,
  value: PropTypes.any,
};

export default DropdownItem;
