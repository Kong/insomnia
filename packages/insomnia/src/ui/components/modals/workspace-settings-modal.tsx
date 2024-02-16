import React from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, Radio, RadioGroup, TextField } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models/index';
import { MockServer } from '../../../models/mock-server';
import { isRequest } from '../../../models/request';
import { isScratchpad, Workspace } from '../../../models/workspace';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';

interface Props {
  onClose: () => void;
  workspace: Workspace;
  mockServer: MockServer | null;
}

export const WorkspaceSettingsModal = ({ workspace, mockServer, onClose }: Props) => {
  const hasDescription = !!workspace.description;
  const isScratchpadWorkspace = isScratchpad(workspace);

  const activeWorkspaceName = workspace.name;

  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const workspaceFetcher = useFetcher();
  const mockServerFetcher = useFetcher();
  const workspacePatcher = (workspaceId: string, patch: Partial<Workspace>) => {
    workspaceFetcher.submit({ ...patch, workspaceId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/update`,
      method: 'post',
      encType: 'application/json',
    });
  };
  const mockServerPatcher = (mockServerId: string, patch: Partial<MockServer>) => {
    mockServerFetcher.submit({ ...patch, mockServerId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspace._id}/mock-server/update`,
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
                <Label className='text-sm text-[--hl]'>
                  Name
                </Label>
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
                {workspace.scope !== 'mock-server' && (
                  <>
                    <Label className='text-sm text-[--hl]' aria-label='Description'>
                      Description
                    </Label>
                    <MarkdownEditor
                      defaultPreviewMode={hasDescription}
                      placeholder="Write a description"
                      defaultValue={workspace.description}
                      onChange={(description: string) => {
                        workspacePatcher(workspace._id, { description });
                      }}
                    />
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
                  </>)}
                {Boolean(workspace.scope === 'mock-server' && mockServer) && (
                  <>
                    <RadioGroup onChange={value => mockServer && mockServerPatcher(mockServer._id, { useInsomniaCloud: value === 'remote' })} name="type" defaultValue={mockServer?.useInsomniaCloud ? 'remote' : 'local'} className="flex flex-col gap-2">
                      <Label className="text-sm text-[--hl]">
                        Mock type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          value="remote"
                          className="data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <Icon icon="globe" />
                          <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          <p className='pt-2'>
                            The mock server runs on Insomnia cloud. Ideal for collaboration.
                          </p>
                        </Radio>
                        <Radio
                          value="local"
                          className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <Icon icon="laptop" />
                          <Heading className="text-lg font-bold">Local Mock</Heading>
                          <p className="pt-2">
                            The mock server runs locally.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                    {!mockServer?.useInsomniaCloud && <TextField
                      autoFocus
                      name="name"
                      defaultValue={mockServer?.url || ''}
                      className={`group relative flex-1 flex flex-col gap-2 ${mockServer?.useInsomniaCloud ? 'disabled' : ''}`}
                    >
                      <Label className='text-sm text-[--hl]'>
                        Local mock server URL
                      </Label>
                      <Input
                        placeholder="http://localhost:8080"
                        onChange={e => mockServer && mockServerPatcher(mockServer._id, { url: e.target.value })}
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                      <Label className='text-sm text-[--hl]'>
                        You can run a mock server locally. <Link href="https://github.com/Kong/mockbin" className='underline'>Learn more</Link>
                      </Label>
                    </TextField>}
                  </>
                )}
              </div>
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
