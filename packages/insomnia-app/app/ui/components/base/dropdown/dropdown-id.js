import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

class DropdownId extends PureComponent {
  render() {
    const { children } = this.props;

    return <span className="dropdown__id">{children}</span>;
  }
}

DropdownId.propTypes = {
  children: PropTypes.node,
};

export default DropdownId;
