import React, { HTMLAttributes, PureComponent, ReactNode } from 'react';
import classnames from 'classnames';

interface Props extends HTMLAttributes<HTMLDivElement> {
  noScroll?: boolean;
  className?: string;
  children?: ReactNode;
}

class ModalBody extends PureComponent<Props> {
  render() {
    const { className, children, noScroll, ...props } = this.props;
    const classes = classnames(className, 'modal__body theme--dialog__body', {
      'modal__body--no-scroll': noScroll,
    });
    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }
}

export default ModalBody;
