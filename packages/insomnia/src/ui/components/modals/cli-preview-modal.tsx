import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router';

import type { WorkspaceLoaderData } from '../../routes/workspace';
import { CopyButton } from '../base/copy-button';
import { Icon } from '../icon';

function generateCommandArgumentsForRequests(
  workspaceId: string,
  targetFolderId: string | null,
  requestIds: string[],
  keepManualOrder: boolean,
) {
  const shortWorkspaceId = workspaceId.slice(0, 10);

  if (targetFolderId !== null && targetFolderId !== '') {
    return keepManualOrder
      ? shortWorkspaceId + ' -i ' + targetFolderId
      : shortWorkspaceId + ' -i ' + requestIds.join(' -i ');
  }
  return keepManualOrder ? shortWorkspaceId : shortWorkspaceId + ' -i ' + requestIds.join(' -i ');
}

export const CLIPreviewModal = ({
  onClose,
  requestIds,
  targetFolderId,
  keepManualOrder,
  iterationCount,
  delay,
  filePath,
  bail,
}: {
  onClose: () => void;
  requestIds: string[];
  targetFolderId: string | null;
  keepManualOrder: boolean;
  iterationCount: number;
  delay: number;
  filePath: string;
  bail: boolean;
}) => {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { activeEnvironment, activeGlobalEnvironment } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const workspaceIdAndRequestIds = generateCommandArgumentsForRequests(
    workspaceId,
    targetFolderId,
    requestIds,
    keepManualOrder,
  );
  const iterationCountArgument = iterationCount > 1 ? ` -n ${iterationCount}` : '';
  const delayArgument = delay > 0 ? ` --delay-request ${delay}` : '';
  const iterationFilePath = filePath ? ` -d "${filePath}"` : '';
  const bailArgument = bail ? ' --bail' : '';
  const globalEnvironmentArgument = activeGlobalEnvironment
    ? ` --globals ${activeGlobalEnvironment._id.slice(0, 10)}`
    : '';
  const cliCommand = `inso run collection ${workspaceIdAndRequestIds} -e ${activeEnvironment._id.slice(0, 10)}${globalEnvironmentArgument}${iterationCountArgument}${delayArgument}${iterationFilePath}${bailArgument}`;

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-start justify-center bg-black/30"
    >
      <Modal
        className="m-24 flex max-h-[75%] w-full max-w-[75%] flex-col overflow-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Run via CLI
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="text-md h-full w-full flex-row p-2">
                <div className="pb-4">Copy this command to run your collection in the terminal</div>
                <div className="flex max-h-32 min-h-[2em] flex-col overflow-y-auto border border-solid border-[--hl-sm] bg-[--hl-xs] px-2 py-1">
                  <div className="relative flex h-full w-full justify-between gap-[var(--padding-sm)] overflow-auto font-mono">
                    <span>{cliCommand}</span>

                    <CopyButton
                      size="small"
                      content={cliCommand}
                      title="Copy Command"
                      confirmMessage=""
                      className="sticky top-0 self-start"
                    >
                      <i className="fa fa-copy" />
                    </CopyButton>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  className="flex items-center gap-2 rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--hl] transition-colors hover:bg-opacity-90 hover:no-underline"
                  onPress={close}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
