import classnames from 'classnames';
import React, {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Dialog, Modal as RACModal } from 'react-aria-components';

export interface ModalProps {
  centered?: boolean;
  tall?: boolean;
  wide?: boolean;
  skinny?: boolean;
  onShow?: () => void;
  onHide?: () => void;
  children?: ReactNode;
  className?: string;
  maskClosable?: boolean;
  keyboardClosable?: boolean;
}

export interface ModalHandle {
  show: (options?: { onHide?: () => void }) => void;
  hide: () => void;
  toggle: () => void;
  isOpen: () => boolean;
}
export const Modal = forwardRef<ModalHandle, ModalProps>(
  (
    {
      centered,
      children,
      className,
      onHide: onHideProp,
      onShow,
      skinny,
      tall,
      wide,
      maskClosable = true,
      keyboardClosable = true,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [onHideArgument, setOnHideArgument] = useState<() => void>();

    const show: ModalHandle['show'] = useCallback(
      options => {
        options?.onHide && setOnHideArgument(options.onHide);
        setOpen(true);
        onShow?.();
      },
      [onShow],
    );

    const hide = useCallback(() => {
      setOpen(false);
      if (typeof onHideProp === 'function') {
        onHideProp();
      }
      if (typeof onHideArgument === 'function') {
        onHideArgument();
      }
    }, [onHideProp, onHideArgument]);

    useImperativeHandle(
      ref,
      () => ({
        show,
        hide,
        toggle: () => (open ? hide() : show()),
        isOpen: () => open,
      }),
      [show, open, hide],
    );

    const classes = classnames(
      'modal',
      'theme--dialog',
      className,
      { 'modal--fixed-height': tall },
      { 'modal--wide': wide },
      { 'modal--skinny': skinny },
      'z-10',
    );

    useEffect(() => {
      const closeElements = containerRef.current?.querySelectorAll('[data-close-modal]');

      for (const element of closeElements || []) {
        element.addEventListener('click', hide);
      }

      return () => {
        for (const element of closeElements || []) {
          element.removeEventListener('click', hide);
        }
      };
    }, [hide, open, maskClosable, keyboardClosable]);

    return open ? (
      <RACModal
        ref={containerRef}
        isOpen={open}
        isDismissable={keyboardClosable}
        onOpenChange={isOpen => {
          !isOpen && hide();
        }}
      >
        <Dialog aria-label="Modal" className={classes}>
          <div
            className="modal__backdrop overlay theme--transparent-overlay"
            {...(maskClosable ? { 'data-close-modal': true } : {})}
          />
          <div className={classnames('modal__content__wrapper', { 'modal--centered': centered })}>
            <div className="modal__content">{children}</div>
          </div>
        </Dialog>
      </RACModal>
    ) : null;
  },
);
Modal.displayName = 'Modal';
