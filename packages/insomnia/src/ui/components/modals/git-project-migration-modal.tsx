import React, { type FC } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { Icon } from '../icon';

export const GitProjectMigrationModal: FC<{ onClose: () => void; legacyFile: { name: string; scope: string } }> = ({
  onClose,
  legacyFile,
}) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const migrateLegacyWorkspaceFetcher = useFetcher();

  const migrateLegacyWorkspace = () => {
    migrateLegacyWorkspaceFetcher.submit(
      {},
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/git/migrate-legacy-insomnia-folder-to-file`,
        encType: 'application/json',
      },
    );
  };

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog
          data-loading={migrateLegacyWorkspaceFetcher.state === 'loading' ? 'true' : undefined}
          className="flex h-full flex-1 flex-col overflow-hidden outline-none data-[loading]:animate-pulse"
        >
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Commit changes{' '}
                  {migrateLegacyWorkspaceFetcher.state === 'loading' && (
                    <Icon icon="spinner" className="animate-spin" />
                  )}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div>
                <p className="text-sm text-[--color-font-secondary]">
                  {legacyFile.name} - {legacyFile.scope}
                  You have a legacy Insomnia folder in your project. Would you like to migrate it to a file?
                </p>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
