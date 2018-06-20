// @flow
import * as React from 'react';
import PropTypes from 'prop-types';

type Props = {
  children: React.Node
}

class DropdownButton extends React.PureComponent<Props> {
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
  children: PropTypes.node
};

export default DropdownButton;
