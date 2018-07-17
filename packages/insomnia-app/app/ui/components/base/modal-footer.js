import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

class ModalFooter extends PureComponent {
  render() {
    const { children, className } = this.props;
    return (
      <div
        className={classnames(
          'modal__footer theme--dialog__footer',
          className
        )}>
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
