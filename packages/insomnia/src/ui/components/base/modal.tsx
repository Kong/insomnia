import classnames from 'classnames';
import React, { forwardRef, ReactNode, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { createKeybindingsHandler } from '../keydown-binder';
// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

export interface ModalProps {
  centered?: boolean;
  tall?: boolean;
  wide?: boolean;
  skinny?: boolean;
  onShow?: Function;
  onHide?: Function;
  children?: ReactNode;
  className?: string;
}

export interface ModalHandle {
  show: (options?: { onHide?: () => void }) => void;
  hide: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}
export const Modal = forwardRef<ModalHandle, ModalProps>(({
  centered,
  children,
  className,
  onHide: onHideProp,
  onShow,
  skinny,
  tall,
  wide,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [zIndex, setZIndex] = useState(globalZIndex);
  const [onHideArgument, setOnHideArgument] = useState<() => void>();

  const show: ModalHandle['show'] = useCallback(options => {
    options?.onHide && setOnHideArgument(options.onHide);
    setOpen(true);
    setZIndex(globalZIndex++);
    onShow?.();
  }, [onShow]);

  const hide = useCallback(() => {
    setOpen(false);
    if (typeof onHideProp === 'function') {
      onHideProp();
    }
    if (typeof onHideArgument === 'function') {
      onHideArgument();
    }
  }, [onHideProp, onHideArgument]);

  useImperativeHandle(ref, () => ({
    show,
    hide,
    toggle: () => open ? hide() : show(),
    isOpen: () => open,
  }), [show, open, hide]);

  const classes = classnames(
    'modal',
    'theme--dialog',
    className,
    { 'modal--fixed-height': tall },
    { 'modal--wide': wide },
    { 'modal--skinny': skinny },
  );

  useEffect(() => {
    const closeElements = containerRef.current?.querySelectorAll('[data-close-modal]');

    for (const element of closeElements || []) {
      element.addEventListener('click', hide);
    }
  }, [hide, open]);

  const handleKeydown = createKeybindingsHandler({
    'Escape': () => {
      hide();
    },
  });
  useEffect(() => {
    document.body.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.removeEventListener('keydown', handleKeydown);
    };
  }, [handleKeydown]);

  return (open ?
    <div
      ref={containerRef}
      onKeyDown={handleKeydown}
      tabIndex={-1}
      className={classes}
      style={{ zIndex }}
      aria-hidden={false}
      role="dialog"
    >
      <div className="modal__backdrop overlay theme--transparent-overlay" data-close-modal />
      <div className={classnames('modal__content__wrapper', { 'modal--centered': centered })}>
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>
    : null
  );
});
Modal.displayName = 'Modal';
