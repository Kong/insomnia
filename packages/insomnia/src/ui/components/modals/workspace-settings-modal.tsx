import { useEffect, useState } from 'react';
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
  TextField,
} from 'react-aria-components';
import { useParams } from 'react-router';

import type { MockServer, Workspace } from '~/insomnia-data';
import { removeResponsesForRequest } from '~/models/helpers/response-operations';
import { useGitProjectRepositoryTreeLoaderFetcher } from '~/routes/git.repository-tree';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models/index';
import { isGitProject, type Project } from '../../../models/project';
import { isRequest } from '../../../models/request';
import { safeToUseInsomniaFileName, safeToUseInsomniaFileNameWithExt } from '../../../sync/git/insomnia-filename';
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
  const [description, setDescription] = useState<string>(workspace.description);

  const gitRepoTreeFetcher = useGitProjectRepositoryTreeLoaderFetcher();

  useEffect(() => {
    if (project && isGitProject(project) && gitRepoTreeFetcher.state === 'idle' && !gitRepoTreeFetcher.data) {
      gitRepoTreeFetcher.load({ projectId: project._id });
    }
  }, [project, gitRepoTreeFetcher]);

  const isScratchpadWorkspace = models.workspace.isScratchpad(workspace);

  const activeWorkspaceName = workspace.name;

  const workspaceFetcher = useWorkspaceUpdateActionFetcher();

  const workspacePatcher = (workspaceId: string, patch: Partial<Workspace>) => {
    workspaceFetcher.submit({
      organizationId,
      projectId,
      patch: {
        ...patch,
        workspaceId,
      },
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
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-max max-h-[calc(100%-var(--padding-xl))] w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
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
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex w-full flex-1 basis-96 flex-col gap-2 overflow-hidden overflow-y-auto rounded-sm select-none">
                <TextField
                  name="name"
                  isRequired
                  isReadOnly={isScratchpadWorkspace}
                  defaultValue={activeWorkspaceName}
                  className="group relative flex max-w-full shrink-0 flex-col gap-2 overflow-hidden"
                >
                  <Label className="text-sm text-(--hl)">Name</Label>
                  <Input
                    placeholder="Awesome API"
                    className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) p-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  />
                </TextField>
                {project && isGitProject(project) && gitRepoTreeFetcher.data && !models.workspace.isMcp(workspace) && (
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
                    className="group relative flex w-full max-w-full shrink-0 flex-col gap-2 overflow-hidden"
                  >
                    <Label className="group relative flex flex-col gap-2 overflow-hidden">
                      <span className="text-sm text-(--hl)">File name</span>

                      <div className="grid w-full grid-cols-[min-content_auto] overflow-hidden rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors [grid-template-areas:'input_extension'] focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
                        <Input
                          placeholder={workspace.name ? safeToUseInsomniaFileName(workspace.name) : 'name'}
                          className="w-full min-w-[3ch] outline-hidden [grid-area:input] placeholder:italic focus:outline-hidden"
                        />
                        <span className="-z-10 w-min truncate opacity-0 [grid-area:input]">
                          {safeToUseInsomniaFileName(fileName || workspace.name || 'name')}
                        </span>
                        <span className="text-(--hl) [grid-area:extension]">.yaml</span>
                      </div>
                    </Label>
                    <FieldError className="text-xs text-red-500" />
                  </TextField>
                )}
                {!models.workspace.isMockServer(workspace) && (
                  <>
                    <Label className="text-sm text-(--hl)" aria-label="Description">
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
                    {!models.workspace.isEnvironment(workspace) && !models.workspace.isMcp(workspace) && (
                      <>
                        <Heading>Actions</Heading>
                        <PromptButton
                          onClick={async () => {
                            const docs = await db.getWithDescendants(workspace, [models.request.type]);
                            const requests = docs.filter(isRequest);
                            for (const req of requests) {
                              await removeResponsesForRequest(req._id);
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
                {Boolean(models.workspace.isMockServer(workspace) && mockServer) && (
                  <>
                    <Label className="text-sm text-(--hl)">Mock server type</Label>
                    {mockServer?.useInsomniaCloud ? <p>Cloud Mock</p> : <p>Self-hosted Mock</p>}
                    {!mockServer?.useInsomniaCloud && (
                      <TextField
                        name="mockServerUrl"
                        isRequired
                        defaultValue={mockServer?.url || ''}
                        className="group relative flex flex-1 flex-col gap-2"
                      >
                        <Label className="text-sm text-(--hl)">Self-hosted mock server URL</Label>
                        <Input
                          placeholder="https://example.com"
                          className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) p-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                        />
                        <FieldError className="text-xs text-red-500" />
                      </TextField>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="submit"
                  className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
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
