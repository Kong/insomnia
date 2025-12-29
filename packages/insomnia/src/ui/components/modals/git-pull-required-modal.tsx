import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { Icon } from '../icon';

interface Props {
  title?: string;
  message: string;
  okLabel?: string;
  onConfirm?: () => void;
  onClose?: () => void;
}

export const GitPullRequiredModal = ({ title, message, okLabel, onConfirm, onClose }: Props) => {
  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose?.();
      }}
      isDismissable
      className="fixed top-[50%] left-0 z-10 flex h-(--visual-viewport-height) w-full translate-y-[-50%] items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose?.();
        }}
        className="flex w-full max-w-2xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden data-loading:animate-pulse">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  {title}
                </Heading>

                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="">{message}</div>
              <div className="flex h-10 shrink-0 items-center justify-end gap-2">
                <Button
                  className="h-full gap-2 rounded-md bg-(--color-bg) px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all hover:bg-(--hl-xs)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-pressed:opacity-80"
                  onPress={() => close?.()}
                >
                  Cancel
                </Button>
                <Button
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                  onPress={() => {
                    if (typeof onConfirm === 'function') {
                      onConfirm();
                    }
                  }}
                >
                  {okLabel || 'Ok'}
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
