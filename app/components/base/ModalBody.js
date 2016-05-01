import React from 'react'
import classnames from 'classnames'

const ModalBody = ({className, children}) => (
  <div className={classnames('modal__body', className)}>
    {children}
  </div>
);

export default ModalBody;
