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

export const VariableMissingErrorModal = ({
  isOpen,
  title,
  cancelText,
  onCancel,
  okText,
  children,
  onOk,
  isDismissable = false,
}: Props) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => {
        !isOpen && onCancel?.();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-start justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onCancel?.();
        }}
        isDismissable={isDismissable}
        className="m-[--padding-lg] flex max-h-full w-full max-w-4xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col gap-4 overflow-hidden outline-none">
          <>
            <Heading slot="title" className="text-2xl">
              {title}
            </Heading>
            <div className="">{children}</div>
            <div className="flex flex-1 flex-shrink-0 items-center justify-end gap-2">
              <Button
                className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
                onPress={onCancel}
              >
                {cancelText || 'Cancel'}
              </Button>
              <Button
                className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
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
