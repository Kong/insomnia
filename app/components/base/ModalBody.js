import React, {PropTypes} from 'react';
import classnames from 'classnames';

const ModalBody = ({className, children, noScroll}) => (
  <div className={classnames('modal__body', {'modal__body--no-scroll': noScroll}, className)}>
    {children}
  </div>
);

ModalBody.propTypes = {
  noScroll: PropTypes.bool
};

export default ModalBody;
