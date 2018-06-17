// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

type Props = {
  children: React.Node,
  className?: string,
}

class ModalFooter extends React.PureComponent<Props> {
  render () {
    const {children, className} = this.props;
    return (
      <div className={classnames('modal__footer', className)}>
        {children}
      </div>
    );
  }
}

ModalFooter.propTypes = {
  // Required
  children: PropTypes.node.isRequired,

  // Optional
  className: PropTypes.string
};

export default ModalFooter;
