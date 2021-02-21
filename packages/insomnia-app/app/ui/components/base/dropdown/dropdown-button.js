import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

class DropdownButton extends PureComponent {
  render() {
    const { children, noWrap, ...props } = this.props;
    if (noWrap) {
      return <>{children}</>;
    }
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  }
}

DropdownButton.propTypes = {
  children: PropTypes.node,
  noWrap: PropTypes.bool,
};

export default DropdownButton;
