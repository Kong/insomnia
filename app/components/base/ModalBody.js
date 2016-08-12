import React, {PropTypes} from 'react';
import classnames from 'classnames';

const ModalBody = ({className, children, noScroll, ...props}) => (
  <div className={classnames('modal__body', {'modal__body--no-scroll': noScroll}, className)} {...props}>
    {children}
  </div>
);

ModalBody.propTypes = {
  noScroll: PropTypes.bool
};

export default ModalBody;
