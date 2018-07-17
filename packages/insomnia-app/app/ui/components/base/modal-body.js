import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';

class ModalBody extends PureComponent {
  render() {
    const { className, children, noScroll, ...props } = this.props;
    const classes = classnames(className, 'modal__body theme--dialog__body', {
      'modal__body--no-scroll': noScroll
    });

    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }
}

ModalBody.propTypes = {
  noScroll: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node
};

export default ModalBody;
