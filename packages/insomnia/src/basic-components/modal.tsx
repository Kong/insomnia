import classnames from 'classnames';
import type React from 'react';
import { useRef } from 'react';
import { Overlay, useOverlay } from 'react-aria';
import { Button, Dialog, Heading, Modal as RAModal, ModalOverlay } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  closable?: boolean;
  isDismissable?: boolean;
  className?: string;
  // Custom parents must already establish a positioning context.
  parent?: HTMLElement | null;
  centered?: boolean;
}

export const Modal: React.FC<React.PropsWithChildren<Props>> = ({
  isOpen,
  onClose,
  className,
  title,
  closable,
  isDismissable,
  parent,
  centered,
  children,
}) => {
  const hasCustomParent = parent !== undefined;
  const isScopedModalOpen = hasCustomParent && isOpen && Boolean(parent);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    onClose?.();
  };

  const handleOpenChange = (isOpen: boolean) => {
    !isOpen && handleClose();
  };

  const { overlayProps, underlayProps } = useOverlay(
    {
      isOpen: isScopedModalOpen,
      onClose: handleClose,
      isDismissable,
      shouldCloseOnInteractOutside: element => parent?.contains(element) ?? false,
    },
    dialogRef,
  );

  const dialogContent = (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-2">
          {title && (
            <Heading slot="title" className="text-3xl">
              {title}
            </Heading>
          )}
          {closable && (
            <Button
              className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              onPress={handleClose}
            >
              <Icon icon="x" />
            </Button>
          )}
        </div>
      </div>
      {children}
    </>
  );

  const dialogClassName = classnames(
    'flex flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)',
    className,
  );

  const overlayClassName = classnames('z-10 flex justify-center overflow-y-auto bg-black/30', {
    'items-center': centered,
    'items-start pt-[10%]': !centered,
  });

  if (hasCustomParent) {
    if (!isScopedModalOpen || !parent) {
      return null;
    }

    return (
      <Overlay portalContainer={parent}>
        <div {...underlayProps} className={classnames('absolute inset-0', overlayClassName)}>
          <div {...overlayProps} ref={dialogRef} className={dialogClassName}>
            <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">{dialogContent}</Dialog>
          </div>
        </div>
      </Overlay>
    );
  }

  const overlay = (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      isDismissable={isDismissable}
      className={classnames('fixed top-0 left-0 h-(--visual-viewport-height) w-full', overlayClassName)}
    >
      <RAModal onOpenChange={handleOpenChange} className={dialogClassName}>
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">{dialogContent}</Dialog>
      </RAModal>
    </ModalOverlay>
  );

  return overlay;
};
