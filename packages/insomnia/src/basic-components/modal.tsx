import classnames from 'classnames';
import type React from 'react';
import { Button, Dialog, Heading, Modal as RAModal, ModalOverlay } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  closable?: boolean;
  className?: string;
}

export const Modal: React.FC<React.PropsWithChildren<Props>> = ({
  isOpen,
  onClose,
  className,
  title,
  closable,
  children,
}) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => {
        !isOpen && onClose?.();
      }}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <RAModal
        onOpenChange={isOpen => {
          !isOpen && onClose?.();
        }}
        className={classnames(
          'flex flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)',
          className,
        )}
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <>
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                {' '}
                <div className="flex shrink-0 items-center justify-between gap-2">
                  {title && (
                    <Heading slot="title" className="text-3xl">
                      {title}
                    </Heading>
                  )}
                  {closable && (
                    <Button
                      className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      onPress={() => close()}
                    >
                      <Icon icon="x" />
                    </Button>
                  )}
                </div>
              </div>
              {children}
            </>
          )}
        </Dialog>
      </RAModal>
    </ModalOverlay>
  );
};
