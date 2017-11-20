// @flow
import * as React from 'react';

type Props = {
  children: React.Node,
  disabled: ?boolean
};

class DropdownButton extends React.PureComponent<Props> {
  render () {
    const {children, disabled, ...props} = this.props;
    return (
      <button type="button" disabled={disabled} {...props}>
        {children}
      </button>
    );
  }
}

export default DropdownButton;
