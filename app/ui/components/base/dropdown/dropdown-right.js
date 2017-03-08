import React, {PropTypes, PureComponent} from 'react';
import classnames from 'classnames';

class DropdownRight extends PureComponent {
  render () {
    const {className, children, ...extraProps} = this.props;
    return (
      <span className={classnames('dropdown__right', className)} {...extraProps}>
        {children}
      </span>
    );
  }
}

DropdownRight.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};

export default DropdownRight;
