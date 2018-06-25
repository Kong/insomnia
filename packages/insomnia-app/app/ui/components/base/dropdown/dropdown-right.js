import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

class DropdownRight extends PureComponent {
  render() {
    const { className, children, ...extraProps } = this.props;
    return (
      <span
        className={classnames('dropdown__right', className)}
        {...extraProps}>
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
