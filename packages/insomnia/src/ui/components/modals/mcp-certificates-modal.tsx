import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay, ToggleButton } from 'react-aria-components';
import { useParams } from 'react-router';

import {
  type McpRequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { CACertificate } from '~/ui/components/modals/workspace-certificates-modal';
import { useRequestPatcher } from '~/ui/hooks/use-request';

import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { Icon } from '../icon';

export const MCPCertificatesModal = ({ onClose }: { onClose: () => void }) => {
  const { workspaceId } = useParams() as {
    workspaceId: string;
  };

  const { activeRequest } = useRequestLoaderData()! as McpRequestLoaderData;
  const routeData = useWorkspaceLoaderData()!;
  const patchRequest = useRequestPatcher();
  const { caCertificate } = routeData;

  if (!workspaceId || !activeRequest) {
    return null;
  }

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  Manage Certificates
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-sm text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 flex-col gap-6 overflow-hidden overflow-y-auto rounded select-none">
                <CACertificate caCertificate={caCertificate} />

                <div className="flex flex-col gap-4">
                  <Heading className="text-xl">Extra Options</Heading>
                  <div className="flex items-center justify-between gap-2">
                    <span>SSL Certificate Validation</span>
                    <ToggleButton
                      data-test-id="mcp-reject-unauthorized-toggle"
                      onChange={isSelected => {
                        patchRequest(activeRequest._id, {
                          sslValidation: isSelected,
                        });
                      }}
                      isSelected={activeRequest.sslValidation}
                      className="flex h-full w-[12ch] shrink-0 items-center justify-start gap-2 rounded-sm px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md)"
                    >
                      {({ isSelected }) => (
                        <>
                          <Icon
                            icon={isSelected ? 'toggle-on' : 'toggle-off'}
                            className={`${isSelected ? 'text-(--color-success)' : ''}`}
                          />
                          <span>{isSelected ? 'Enabled' : 'Disabled'}</span>
                        </>
                      )}
                    </ToggleButton>
                  </div>

                  <p className="max-w-[80ch] text-sm text-(--hl)">
                    When disabled, SSL/TLS certificates will not be validated. Disabling this allows connecting to
                    servers with self-signed, expired, or invalid certificates. It is recommended that you only disable
                    this when using trusted local development environments.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  onPress={close}
                  className="hover:bg-opacity-90 rounded-sm border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
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
