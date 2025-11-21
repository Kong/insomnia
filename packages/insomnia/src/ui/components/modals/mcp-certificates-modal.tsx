import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useParams } from 'react-router';

import { CACertificate } from '~/ui/components/modals/workspace-certificates-modal';

import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { Icon } from '../icon';

export const MCPCertificatesModal = ({ onClose }: { onClose: () => void }) => {
  const { workspaceId } = useParams() as {
    workspaceId: string;
  };

  const routeData = useWorkspaceLoaderData()!;

  const { caCertificate } = routeData;

  if (!workspaceId) {
    return null;
  }

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex w-full max-w-3xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  Manage Certificates
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 select-none flex-col gap-6 overflow-hidden overflow-y-auto rounded">
                <CACertificate caCertificate={caCertificate} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
