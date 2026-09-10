import { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, Tooltip, TooltipTrigger } from 'react-aria-components';

import { useInsomniaSyncDeleteRemoteFileActionFetcher } from '~/routes/organization.$organizationId.insomnia-sync.delete-remote-file';
import { Icon } from '~/ui/components/icon';
import { showToast } from '~/ui/components/toast-notification';

interface Props {
  organizationId: string;
  backendProjectId: string;
  name: string;
}

export const UnsyncedFileDeleteButton = ({ organizationId, backendProjectId, name }: Props) => {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const deleteRemoteFileFetcher = useInsomniaSyncDeleteRemoteFileActionFetcher();
  const isDeleting = deleteRemoteFileFetcher.state !== 'idle';
  const error = deleteRemoteFileFetcher.data?.error;

  useEffect(() => {
    if (error && deleteRemoteFileFetcher.state === 'idle') {
      showToast({
        title: 'Failed to delete remote file',
        icon: 'star',
        status: 'error',
        description: `Failed to delete ${name}: ${error}`,
      });
    }
  }, [error, deleteRemoteFileFetcher.state, name]);

  return (
    <>
      <TooltipTrigger>
        <Button
          aria-label="Delete unsynced file"
          isDisabled={isDeleting}
          onPress={() => setIsConfirmModalOpen(true)}
          className="flex aspect-square h-5 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:text-(--color-danger) focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset"
        >
          <Icon icon={isDeleting ? 'spinner' : 'trash'} spin={isDeleting} />
        </Button>
        <Tooltip
          placement="top"
          offset={8}
          className="flex max-h-[85vh] min-w-max items-center gap-2 overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
        >
          Delete permanently
        </Tooltip>
      </TooltipTrigger>
      {isConfirmModalOpen && (
        <ModalOverlay
          isOpen
          onOpenChange={() => setIsConfirmModalOpen(false)}
          isDismissable
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => setIsConfirmModalOpen(false)}
            className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
          >
            <Dialog className="outline-hidden">
              {({ close }) => (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-2xl">Delete file</Heading>
                    <Button
                      className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <p className="line-clamp-5">
                    This will permanently delete <strong className="break-all whitespace-pre-wrap">{name}</strong> from
                    the Cloud for everyone. You cannot undo this action.
                  </p>
                  <div className="flex justify-end">
                    <Button
                      aria-label="Delete unsynced file permanently"
                      isDisabled={isDeleting}
                      onPress={() => {
                        deleteRemoteFileFetcher.submit({ organizationId, backendProjectId });
                        close();
                      }}
                      className="rounded-xs border border-solid border-(--hl-md) bg-(--color-danger) px-3 py-2 text-(--color-font-danger) transition-colors hover:bg-(--color-danger)/90 hover:no-underline"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};
