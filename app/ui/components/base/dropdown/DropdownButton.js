import React, {PureComponent} from 'react';

class DropdownButton extends PureComponent {
  render () {
    const {children, ...props} = this.props;
    return (
      <button type="button" {...props}>
        {children}
      </button>
    )
  }
}

DropdownButton.propTypes = {};

export default DropdownButton;
