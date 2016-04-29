import React from 'react';
import classnames from 'classnames';

const ModalBody = ({className, children}) => (
  <div className={classnames('modal__body', 'scrollable', className)}>
    {children}
  </div>
);

export default ModalBody;
