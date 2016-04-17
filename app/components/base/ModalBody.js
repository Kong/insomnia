import React from 'react';
import classnames from 'classnames';

const ModalBody = (props) => (
  <div className={classnames('modal__body', 'scrollable', props.className)}>
    {props.children}
  </div>
);

export default ModalBody;
