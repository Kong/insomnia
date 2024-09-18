import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import type { WorkspaceLoaderData } from '../../routes/workspace';
import { CopyButton } from '../base/copy-button';
import { Icon } from '../icon';

export const CLIPreviewModal = ({ onClose, requestIds, allSelected, iterations, delay, filePath }: { onClose: () => void; requestIds: string[]; allSelected: boolean; iterations: number; delay: number; filePath: string }) => {
  const { workspaceId } = useParams() as { workspaceId: string };
  const { activeEnvironment } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const workspaceIdOrRequestIds = allSelected ? workspaceId.slice(0, 10) : '-i ' + requestIds.join(' -i ');
  const iterationsArgument = iterations > 1 ? ` -n ${iterations}` : '';
  const delayArgument = delay > 0 ? ` --delay-request ${delay}` : '';
  const iterationFilePath = filePath ? ` -d ${filePath}` : '';
  const cliCommand = `inso run collection ${workspaceIdOrRequestIds} -e ${activeEnvironment._id.slice(0, 10)}${iterationsArgument}${delayArgument}${iterationFilePath}`;

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-start justify-center bg-black/30"
    >
      <Modal
        className="max-h-[75%] overflow-auto flex flex-col w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font] m-24"
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Run via CLI</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="h-full w-full text-md flex-row p-2">
                <div className="pb-4">Copy this command to run your collection in the terminal</div>
                <div className="max-h-32 flex flex-col overflow-y-auto min-h-[2em] bg-[--hl-xs] px-2 py-1 border border-solid border-[--hl-sm]">
                  <div className="flex justify-between overflow-auto relative h-full gap-[var(--padding-sm)] w-full text-center font-mono">
                    <span>{cliCommand}</span>

                    <CopyButton
                      size="small"
                      content={cliCommand}
                      title="Copy Command"
                      confirmMessage=""
                      className='self-start sticky top-0'
                    >
                      <i className="fa fa-copy" />
                    </CopyButton>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <Button
                  className="hover:no-underline flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--hl] transition-colors rounded-sm"
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
