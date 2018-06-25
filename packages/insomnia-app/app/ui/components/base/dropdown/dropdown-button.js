import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

class DropdownButton extends PureComponent {
  render() {
    const { children, ...props } = this.props;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  }
}

DropdownButton.propTypes = {
  children: PropTypes.node
};

export default DropdownButton;
