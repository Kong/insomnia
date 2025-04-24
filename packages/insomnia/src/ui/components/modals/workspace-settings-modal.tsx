import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  TextField,
} from 'react-aria-components';
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
import {
  DEFAULT_STORAGE_RULES,
  fetchAndCacheOrganizationStorageRule,
  type OrganizationLoaderData,
  type StorageRules,
} from '../../routes/organization';
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
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
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
    workspaceFetcher.submit(
      { ...patch, workspaceId },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/update`,
        method: 'post',
        encType: 'application/json',
      },
    );
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
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-max max-h-[calc(100%-var(--padding-xl))] w-full max-w-3xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <Form
              validationBehavior="native"
              onSubmit={event => {
                event.preventDefault();

                const form = event.currentTarget;
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                workspacePatcher(workspace._id, data);
              }}
              className="flex h-full flex-1 flex-col gap-4 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  {getWorkspaceLabel(workspace).singular} Settings{' '}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 select-none flex-col gap-2 overflow-hidden overflow-y-auto rounded">
                <TextField
                  name="name"
                  isRequired
                  isReadOnly={isScratchpadWorkspace}
                  defaultValue={activeWorkspaceName}
                  className="group relative flex max-w-full flex-shrink-0 flex-col gap-2 overflow-hidden"
                >
                  <Label className="text-sm text-[--hl]">Name</Label>
                  <Input
                    placeholder="Awesome API"
                    className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] p-2 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                  />
                </TextField>
                {project && isGitProject(project) && gitRepoTreeFetcher.data && (
                  <TextField
                    name="fileName"
                    isRequired
                    validate={fileName => {
                      if (
                        selectedFolderChildren
                          .filter(name => name !== fileName)
                          .includes(safeToUseInsomniaFileNameWithExt(fileName))
                      ) {
                        return 'A file with the same name already exists in the selected folder';
                      }

                      return null;
                    }}
                    defaultValue={safeToUseInsomniaFileName(fileName || '')}
                    className="group relative flex w-full max-w-full flex-shrink-0 flex-col gap-2 overflow-hidden"
                  >
                    <Label className="group relative flex flex-col gap-2 overflow-hidden">
                      <span className="text-sm text-[--hl]">File name</span>

                      <div className="grid w-full overflow-hidden rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors [grid-template-areas:'input_extension'] [grid-template-columns:min-content_auto] focus:outline-none focus:ring-1 focus:ring-[--hl-md]">
                        <Input
                          placeholder={workspace.name ? safeToUseInsomniaFileName(workspace.name) : 'name'}
                          className="w-full min-w-[3ch] outline-none [grid-area:input] placeholder:italic focus:outline-none"
                        />
                        <span className="-z-10 w-min truncate opacity-0 [grid-area:input]">
                          {safeToUseInsomniaFileName(fileName || workspace.name || 'name')}
                        </span>
                        <span className="text-[--hl] [grid-area:extension]">.yaml</span>
                      </div>
                    </Label>
                    <FieldError className="text-xs text-red-500" />
                  </TextField>
                )}
                {!isMockServer(workspace) && (
                  <>
                    <Label className="text-sm text-[--hl]" aria-label="Description">
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
                    <Input name="description" className="sr-only" value={description} />
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
                          className="width-auto btn btn--clicky space-left inline-block"
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
                      <Label className="text-sm text-[--hl]">Mock server type</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="cloud"
                          isDisabled={isCloudProjectDisabled}
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          </div>
                          <p className="pt-2">Runs on Insomnia cloud, ideal for collaboration.</p>
                        </Radio>
                        <Radio
                          value="self-hosted"
                          isDisabled={isSelfHostedDisabled}
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
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
                      <FieldError className="text-xs text-red-500" />
                    </RadioGroup>
                    <div className="flex items-center gap-2 text-sm">
                      <Icon icon="info-circle" />
                      <span>
                        To learn more about self hosting{' '}
                        <Link href="https://docs.insomnia.rest/insomnia/api-mocking" className="underline">
                          click here
                        </Link>
                      </span>
                    </div>
                    {!isSelfHostedDisabled && (
                      <TextField
                        autoFocus
                        name="mockServerUrl"
                        defaultValue={mockServer?.url || ''}
                        className={`group relative flex flex-1 flex-col gap-2 ${mockServer?.useInsomniaCloud ? 'disabled' : ''}`}
                      >
                        <Label className="text-sm text-[--hl]">Self-hosted mock server URL</Label>
                        <Input
                          disabled={mockServer?.useInsomniaCloud}
                          placeholder={mockServer?.useInsomniaCloud ? '' : 'https://example.com'}
                          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                        />
                      </TextField>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
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
