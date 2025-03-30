import React, { useEffect, useState } from 'react';
import { Button, Dialog, FieldError, Form, Heading, Input, Label, Modal, ModalOverlay, Radio, RadioGroup, TextField } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models/index';
import type { MockServer } from '../../../models/mock-server';
import { isGitProject, type Project } from '../../../models/project';
import { isRequest } from '../../../models/request';
import { isEnvironment, isMockServer, isScratchpad, type Workspace } from '../../../models/workspace';
import { safeToUseInsomniaFileName, safeToUseInsomniaFileNameWithExt } from '../../routes/actions';
import type { GetRepositoryDirectoryTreeResult } from '../../routes/git-project-actions';
import { DEFAULT_STORAGE_RULES, fetchAndCacheOrganizationStorageRule, type OrganizationLoaderData, type StorageRules } from '../../routes/organization';
import { Link } from '../base/link';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { MarkdownEditor } from '../markdown-editor';

interface Props {
  onClose: () => void;
  workspace: Workspace;
  mockServer?: MockServer | null;
  gitFilePath?: string | null;
  project?: Project;
}

export const WorkspaceSettingsModal = ({ workspace, gitFilePath, project, mockServer, onClose }: Props) => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const [orgStorageRules, setOrgStorageRules] = useState<StorageRules>(DEFAULT_STORAGE_RULES);
  const [description, setDescription] = useState<string>(workspace.description);
  useEffect(() => {
    fetchAndCacheOrganizationStorageRule(organizationId as string).then(setOrgStorageRules);
  }, [organizationId]);

  const gitRepoTreeFetcher = useFetcher<GetRepositoryDirectoryTreeResult>();

  useEffect(() => {
    if (project && isGitProject(project) && gitRepoTreeFetcher.state === 'idle' && !gitRepoTreeFetcher.data) {
      gitRepoTreeFetcher.load(`/organization/${organizationId}/project/${project._id}/git/repository-tree`);
    }
  }, [project, gitRepoTreeFetcher, organizationId]);

  const isLocalProject = !project?.remoteId;
  const isEnterprise = currentPlan?.type.includes('enterprise');
  const isSelfHostedDisabled = !isEnterprise || !orgStorageRules.enableLocalVault;
  const isCloudProjectDisabled = isLocalProject || !orgStorageRules.enableCloudSync;

  const isScratchpadWorkspace = isScratchpad(workspace);

  const activeWorkspaceName = workspace.name;

  const workspaceFetcher = useFetcher();

  const workspacePatcher = (workspaceId: string, patch: Partial<Workspace>) => {
    workspaceFetcher.submit({ ...patch, workspaceId }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/update`,
      method: 'post',
      encType: 'application/json',
    });
  };

  useEffect(() => {
    if (workspaceFetcher.state === 'idle' && workspaceFetcher.data && workspaceFetcher.data.success) {
      onClose();
    }
  }, [onClose, workspaceFetcher]);

  // From the folderPath we need to get the folder children and validate that there is no file with the same name
  // Get the folder from the gitFilePath
  const selectedFolder = gitFilePath?.split('/').slice(1).join('/') || '';
  const fileName = gitFilePath?.split('/').pop() || '';
  const selectedFolderChildren = gitRepoTreeFetcher.data?.folderList[selectedFolder] || [];

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
            <Form
              validationBehavior='native'
              onSubmit={event => {
                event.preventDefault();

                const form = event.currentTarget;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                workspacePatcher(workspace._id, data);
              }}
              className='flex-1 flex flex-col gap-4 overflow-hidden h-full'
            >
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
                <TextField
                  name="name"
                  isRequired
                  isReadOnly={isScratchpadWorkspace}
                  defaultValue={activeWorkspaceName}
                  className="group relative flex-shrink-0 flex flex-col gap-2 overflow-hidden max-w-full"
                >
                  <Label className='text-sm text-[--hl]'>
                    Name
                  </Label>
                  <Input
                    placeholder='Awesome API'
                    className='p-2 w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'
                  />
                </TextField>
                {project && isGitProject(project) && gitRepoTreeFetcher.data && (
                  <TextField
                    name="fileName"
                    isRequired
                    validate={fileName => {
                      if (selectedFolderChildren.filter(name => name !== fileName).includes(safeToUseInsomniaFileNameWithExt(fileName))) {
                        return 'A file with the same name already exists in the selected folder';
                      }

                      return null;
                    }}
                    defaultValue={safeToUseInsomniaFileName(fileName || '')}
                    className="group relative w-full flex-shrink-0 flex flex-col gap-2 overflow-hidden max-w-full"
                  >
                    <Label className="group relative flex flex-col gap-2 overflow-hidden">
                      <span className='text-sm text-[--hl]'>
                        File name
                      </span>

                      <div className="overflow-hidden grid [grid-template-columns:min-content_auto] [grid-template-areas:'input_extension'] focus:outline-none py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:ring-1 focus:ring-[--hl-md] transition-colors">
                        <Input
                          placeholder={workspace.name ? safeToUseInsomniaFileName(workspace.name) : 'name'}
                          className="[grid-area:input] placeholder:italic outline-none focus:outline-none w-full min-w-[3ch]"
                        />
                        <span className='[grid-area:input] -z-10 opacity-0 truncate w-min'>{safeToUseInsomniaFileName(fileName || workspace.name || 'name')}</span>
                        <span className='[grid-area:extension] text-[--hl]'>.yaml</span>
                      </div>
                    </Label>
                    <FieldError className='text-red-500 text-xs' />
                  </TextField>
                )}
                {!isMockServer(workspace) && (
                  <>
                    <Label className='text-sm text-[--hl]' aria-label='Description'>
                      Description
                    </Label>
                    <MarkdownEditor
                      key={workspace._id}
                      placeholder="Write a description"
                      defaultValue={workspace.description}
                      onChange={(description: string) => {
                        setDescription(description);
                      }}
                    />
                    <Input name="description" className='sr-only' value={description} />
                    {!isEnvironment(workspace) && (
                      <>
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
                      </>
                    )}
                  </>
                )}
                {Boolean(isMockServer(workspace) && mockServer) && (
                  <>
                    <RadioGroup
                      name="mockServerType"
                      defaultValue={mockServer?.useInsomniaCloud ? 'cloud' : 'self-hosted'}
                      validate={value => {
                        if (!isEnterprise && value === 'self-hosted') {
                          return 'Self-hosted Mocks are only supported for Enterprise users.';
                        }

                        return null;
                      }}
                      className="flex flex-col gap-2"
                    >
                      <Label className="text-sm text-[--hl]">
                        Mock server type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          value="cloud"
                          isDisabled={isCloudProjectDisabled}
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          </div>
                          <p className='pt-2'>
                            Runs on Insomnia cloud, ideal for collaboration.
                          </p>
                        </Radio>
                        <Radio
                          value="self-hosted"
                          isDisabled={isSelfHostedDisabled}
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="server" />
                            <Heading className="text-lg font-bold">Self-hosted Mock</Heading>
                          </div>
                          <p className="pt-2">
                            Runs locally or on your infrastructure, ideal for private usage and lower latency.
                          </p>
                        </Radio>
                      </div>
                      <FieldError className="text-red-500 text-xs" />
                    </RadioGroup>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon icon="info-circle" />
                      <span>
                        To learn more about self hosting <Link href="https://docs.insomnia.rest/insomnia/api-mocking" className='underline'>click here</Link>
                      </span>
                    </div>
                    {!isSelfHostedDisabled && (
                      <TextField
                        autoFocus
                        name="mockServerUrl"
                        defaultValue={mockServer?.url || ''}
                        className={`group relative flex-1 flex flex-col gap-2 ${mockServer?.useInsomniaCloud ? 'disabled' : ''}`}
                      >
                        <Label className='text-sm text-[--hl]'>
                          Self-hosted mock server URL
                        </Label>
                        <Input
                          disabled={mockServer?.useInsomniaCloud}
                          placeholder={mockServer?.useInsomniaCloud ? '' : 'https://example.com'}
                          className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                        />
                      </TextField>
                    )}
                  </>
                )}
              </div>
              <div className='flex items-center gap-2 justify-end'>
                <Button
                  type='submit'
                  className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                >
                  Update
                </Button>
              </div>
            </Form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
