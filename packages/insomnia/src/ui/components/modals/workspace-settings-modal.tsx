import React from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models/index';
import { isRequest } from '../../../models/request';
import { isScratchpad, Workspace } from '../../../models/workspace';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';

interface Props {
  onClose: () => void;
  workspace: Workspace;
}

export const WorkspaceSettingsModal = ({ workspace, onClose }: Props) => {
  const hasDescription = !!workspace.description;
  const isScratchpadWorkspace = isScratchpad(workspace);

  const activeWorkspaceName = workspace.name;

  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const workspaceFetcher = useFetcher();
  const workspacePatcher = (workspaceId: string, patch: Partial<Workspace>) => {
    workspaceFetcher.submit({ ...patch, workspaceId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/update`,
      method: 'post',
      encType: 'application/json',
    });
  };

  return (
    <ModalOverlay
      isOpen
      isDismissable
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-full max-w-3xl h-max max-h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden h-full'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl flex items-center gap-2'>{getWorkspaceLabel(workspace).singular} Settings{' '}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='rounded flex-1 w-full overflow-hidden basis-96 flex flex-col gap-2 select-none overflow-y-auto'>
                <Label className='flex flex-col gap-1 px-1' aria-label='Host'>
                  <span>Name</span>
                  <Input
                    name='name'
                    type='text'
                    required
                    readOnly={isScratchpadWorkspace}
                    defaultValue={activeWorkspaceName}
                    placeholder='Awesome API'
                    className='p-2 w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'
                    onChange={event => workspacePatcher(workspace._id, { name: event.target.value })}
                  />
                </Label>
                <Label className='flex flex-col px-1 gap-1' aria-label='Description'>
                  <span>Description</span>
                  <MarkdownEditor
                    defaultPreviewMode={hasDescription}
                    placeholder="Write a description"
                    defaultValue={workspace.description}
                    onChange={(description: string) => {
                      workspacePatcher(workspace._id, { description });
                    }}
                  />
                </Label>
              </div>
              <Heading>Actions</Heading>
              <PromptButton
                onClick={async () => {
                  const docs = await db.withDescendants(workspace, models.request.type);
                  const requests = docs.filter(isRequest);
                  for (const req of requests) {
                    await models.response.removeForRequest(req._id);
                  }
                  close();
                }}
                className="width-auto btn btn--clicky inline-block space-left"
              >
                <i className="fa fa-trash-o" /> Clear All Responses
              </PromptButton>
              <div className='flex items-center gap-2 justify-end'>
                <Button
                  onPress={close}
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay >
  );
};
WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
