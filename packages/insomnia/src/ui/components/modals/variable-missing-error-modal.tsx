import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

interface Props {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onOk: () => void;
  okText?: string;
  onCancel: () => void;
  cancelText?: string;
  isDismissable?: boolean;
}

export const VariableMissingErrorModal = ({ isOpen, title, cancelText, onCancel, okText, children, onOk, isDismissable = false }: Props) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => {
        !isOpen && onCancel?.();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-start justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onCancel?.();
        }}
        isDismissable={isDismissable}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] m-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog className="outline-none flex-1 h-full flex flex-col gap-4 overflow-hidden">
          <>
            <Heading
              slot="title"
              className="text-2xl"
            >
              {title}
            </Heading>
            <div className=''>
              {children}
            </div>
            <div className="flex flex-shrink-0 flex-1 justify-end gap-2 items-center">
              <Button
                className="hover:no-underline flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                onPress={onCancel}
              >
                {cancelText || 'Cancel'}
              </Button>
              <Button
                className="hover:no-underline flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                onPress={onOk}
              >
                {okText || 'OK'}
              </Button>
            </div>
          </>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
