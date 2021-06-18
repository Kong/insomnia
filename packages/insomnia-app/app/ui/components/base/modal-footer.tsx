import React, { PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

interface Props {
  className?: string;
  children: ReactNode;
}

class ModalFooter extends PureComponent<Props> {
  render() {
    const { children, className } = this.props;
    return (
      <div className={classnames('modal__footer theme--dialog__footer', className)}>{children}</div>
    );
  }
}

export default ModalFooter;
