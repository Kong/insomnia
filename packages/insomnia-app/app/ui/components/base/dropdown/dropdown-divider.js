// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

type Props = {
  children: React.Node
}

class DropdownDivider extends React.PureComponent<Props> {
  render () {
    const {children} = this.props;

    const classes = classnames(
      'dropdown__divider',
      {'dropdown__divider--no-name': !children}
    );

    return (
      <div className={classes}>
      <span className="dropdown__divider__label">
        {children}
      </span>
      </div>
    );
  }
}

DropdownDivider.propTypes = {
  children: PropTypes.node
};

export default DropdownDivider;
