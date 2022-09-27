import classnames from 'classnames';
import React, { forwardRef, ReactNode, useCallback, useImperativeHandle, useState } from 'react';

import { useGlobalKeyboardShortcuts } from '../keydown-binder';
// Keep global z-index reference so that every modal will
// appear over top of an existing one.
let globalZIndex = 1000;

export interface ModalProps {
  centered?: boolean;
  tall?: boolean;
  wide?: boolean;
  skinny?: boolean;
  noEscape?: boolean;
  onShow?: Function;
  onHide?: Function;
  children?: ReactNode;
  className?: string;
}

export interface ModalHandle {
  show: (options?: { onHide: () => void }) => void;
  hide: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}
export const Modal = forwardRef<ModalHandle, ModalProps>(({
  centered,
  children,
  className,
  noEscape,
  onHide: onHideProp,
  onShow,
  skinny,
  tall,
  wide,
}, ref) => {
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
    onHideProp?.();
    onHideArgument?.();
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
    { 'modal--noescape': noEscape },
    { 'modal--wide': wide },
    { 'modal--skinny': skinny },
  );

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Don't check for close keys if we don't want them
    if (noEscape) {
      return;
    }
    // Did we click a close button. Let's check a few parent nodes up as well
    // because some buttons might have nested elements. Maybe there is a better
    // way to check this?
    let currentElement: ParentNode | null = event.target instanceof HTMLElement ? event.target : null;
    let shouldHide = false;
    for (let i = 0; i < 5; i++) {
      if (!currentElement) {
        break;
      }
      if (currentElement instanceof HTMLElement && currentElement.hasAttribute('data-close-modal')) {
        shouldHide = true;
        break;
      }
      currentElement = currentElement.parentNode;
    }

    if (shouldHide) {
      hide();
    }
  }, [hide, noEscape]);

  useGlobalKeyboardShortcuts({
    'CLOSE_MODAL': () => {
      if (!noEscape) {
        hide();
      }
    },
  });
  return (open ?
    <div
      tabIndex={-1}
      className={classes}
      style={{ zIndex }}
      aria-hidden={false}
      onClick={handleClick}
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
