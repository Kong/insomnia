import React from 'react'
import classnames from 'classnames'

const ModalHeader = ({className, children}) => (
  <div className={classnames('modal__header', className)}>
    <button className="btn btn--compact modal__close-btn" data-close-modal="true">
      <i className="fa fa-times"></i>
    </button>
    {children}
  </div>
);

export default ModalHeader;
