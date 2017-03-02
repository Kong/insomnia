import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';

@autobind
class DropdownItem extends PureComponent {
  constructor (props) {
    super(props);
  }

  _handleClick (e) {
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
  }

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
        <div className="dropdown__text">{children}</div>
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
