// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

type Props = {
  children: React.Node,
  className: string,
}

class DropdownRight extends React.PureComponent<Props> {
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
