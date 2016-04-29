import React from 'react';

const ModalFooter = ({className, children }) => (
  <div className="modal__footer">
    <div className={className}>
      {children}
    </div>
  </div>
);

export default ModalFooter;
