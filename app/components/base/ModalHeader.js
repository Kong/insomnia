import React from 'react';

const ModalHeader = (props) => (
  <div className="modal__header bg-light">
    <div className="grid">
      <div className="grid__cell pad">
        <div className={props.className}>
          {props.children}
        </div>
      </div>
      <div className="grid--v">
        <button className="btn btn--compact txt-lg" data-close-modal="true">
          <i className="fa fa-times"></i>
        </button>
      </div>
    </div>
  </div>
);

export default ModalHeader;
