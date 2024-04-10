import React from 'react';
import { Button, Dialog, Heading, Input, Label, Modal, ModalOverlay, Radio, RadioGroup, TextField } from 'react-aria-components';
import { useFetcher, useRouteLoaderData } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models/index';
import { MockServer } from '../../../models/mock-server';
import { isRequest } from '../../../models/request';
import { isScratchpad, Workspace } from '../../../models/workspace';
import { OrganizationLoaderData } from '../../routes/organization';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';
import { showModal } from '.';
import { AlertModal } from './alert-modal';

interface Props {
  onClose: () => void;
  workspace: Workspace;
  mockServer?: MockServer | null;
}

export const WorkspaceSettingsModal = ({ workspace, mockServer, onClose }: Props) => {
  const hasDescription = !!workspace.description;
  const isScratchpadWorkspace = isScratchpad(workspace);
  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;

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
                    <RadioGroup
                      name="mockServerType"
                      defaultValue={mockServer?.useInsomniaCloud ? 'cloud' : 'self-hosted'}
                      onChange={value => {
                        const isEnterprise = currentPlan?.type.includes('enterprise');
                        if (!isEnterprise && value === 'self-hosted') {
                          showModal(AlertModal, {
                            title: 'Upgrade required',
                            message: 'Self-hosted Mocks are only supported for Enterprise users.',
                          });
                          return;
                        }
                        mockServer && mockServerPatcher(mockServer._id, { useInsomniaCloud: value === 'cloud' });
                      }}
                      className="flex flex-col gap-2"
                    >
                      <Label className="text-sm text-[--hl]">
                        Mock server type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          value="cloud"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          </div>
                          <p className='pt-2'>
                            The mock server runs on Insomnia cloud, ideal for creating API mocks collaboratively.
                          </p>
                        </Radio>
                        <Radio
                          value="self-hosted"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="server" />
                            <Heading className="text-lg font-bold">Self-hosted Mock</Heading>
                          </div>
                          <p className="pt-2">
                            The mock servers are self hosted, ideal for private usage and lower latency.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                    <TextField
                      autoFocus
                      name="name"
                      defaultValue={mockServer?.url || ''}
                      className={`group relative flex-1 flex flex-col gap-2 ${mockServer?.useInsomniaCloud ? 'disabled' : ''}`}
                    >
                      <Label className='text-sm text-[--hl]'>
                        Mock server URL
                      </Label>
                      <Input
                        disabled={mockServer?.useInsomniaCloud}
                        placeholder="https://mock.insomnia.rest"
                        onChange={e => mockServer && mockServerPatcher(mockServer._id, { url: e.target.value })}
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                      <Label className='text-sm text-[--hl]'>
                        You can self-host a mock server. Click here to <Link href="https://github.com/Kong/insomnia-mockbin" className='underline'>learn more</Link>
                      </Label>
                    </TextField>
                  </>
                )}
              </div>
              <div className='flex items-center gap-2 justify-end'>
                <Button
                  onPress={close}
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                >
                  Update
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
