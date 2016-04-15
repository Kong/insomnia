import React from 'react';

const ModalFooter = (props) => (
  <div className="modal__footer">
    <div className={props.className}>
      {props.children}
    </div>
  </div>
);

export default ModalFooter;
