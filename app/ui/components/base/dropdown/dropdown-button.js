import React, {PropTypes, PureComponent} from 'react';

class DropdownButton extends PureComponent {
  render () {
    const {children, ...props} = this.props;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    );
  }
}

DropdownButton.propTypes = {
  children: PropTypes.array.isRequired
};

export default DropdownButton;
