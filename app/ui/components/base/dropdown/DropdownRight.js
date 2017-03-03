import React, {PureComponent} from 'react';
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

DropdownRight.propTypes = {};

export default DropdownRight;
