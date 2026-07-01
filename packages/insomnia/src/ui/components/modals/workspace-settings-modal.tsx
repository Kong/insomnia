import type { MockServer, Project, Workspace } from 'insomnia-data';
import { models, services } from 'insomnia-data';
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

import { useGitProjectRepositoryTreeLoaderFetcher } from '~/routes/git.repository-tree';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { UnsavedChangesGuard } from '~/ui/components/unsaved-changes-guard';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
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
  const [nameValue, setNameValue] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description);
  const [mockServerUrlValue, setMockServerUrlValue] = useState(mockServer?.url || '');

  const gitRepoTreeFetcher = useGitProjectRepositoryTreeLoaderFetcher();

  useEffect(() => {
    if (
      project &&
      models.project.isGitProject(project) &&
      gitRepoTreeFetcher.state === 'idle' &&
      !gitRepoTreeFetcher.data
    ) {
      gitRepoTreeFetcher.load({ projectId: project._id });
    }
  }, [project, gitRepoTreeFetcher]);

  // When the modal is opened without a gitFilePath prop (e.g. from the project
  // sidebar), resolve it from the workspace meta so the File name field is populated.
  const [metaGitFilePath, setMetaGitFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (gitFilePath || !project || !models.project.isGitProject(project)) {
      return;
    }

    let isMounted = true;
    services.workspaceMeta.getByParentId(workspace._id).then(meta => {
      if (isMounted && meta?.gitFilePath) {
        setMetaGitFilePath(meta.gitFilePath);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [gitFilePath, project, workspace._id]);

  const isScratchpadWorkspace = models.workspace.isScratchpad(workspace);

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
  const effectiveGitFilePath = gitFilePath || metaGitFilePath || '';
  const selectedFolder = effectiveGitFilePath.split('/').slice(1).join('/') || '';
  const fileName = effectiveGitFilePath.split('/').pop() || '';
  const selectedFolderChildren = gitRepoTreeFetcher.data?.folderList[selectedFolder] || [];

  const [fileNameValue, setFileNameValue] = useState<string>(safeToUseInsomniaFileName(fileName || ''));

  const changedFieldCount = [
    nameValue !== workspace.name,
    fileNameValue !== safeToUseInsomniaFileName(fileName || ''),
    description !== workspace.description,
    mockServerUrlValue !== (mockServer?.url || ''),
  ].filter(Boolean).length;

  // Keep the controlled file name in sync once the git file path resolves - it may
  // arrive asynchronously when loaded from the workspace meta (e.g. opened from the sidebar).
  useEffect(() => {
    if (fileName) {
      setFileNameValue(safeToUseInsomniaFileName(fileName));
    }
  }, [fileName]);

  return (
    <UnsavedChangesGuard hasUnsavedChanges={changedFieldCount > 1} onClose={onClose}>
      {({ requestClose }) => (
        <ModalOverlay
          isOpen
          isDismissable={false}
          onOpenChange={open => {
            if (!open) requestClose();
          }}
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
        >
          <Modal className="flex h-max max-h-[calc(100%-var(--padding-xl))] w-full max-w-3xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
            <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
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
                    onPress={requestClose}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                <div className="flex w-full flex-1 basis-96 flex-col gap-2 overflow-hidden overflow-y-auto rounded-sm select-none">
                  <TextField
                    name="name"
                    isRequired
                    isReadOnly={isScratchpadWorkspace}
                    value={nameValue}
                    onChange={setNameValue}
                    className="group relative flex max-w-full shrink-0 flex-col gap-2 overflow-hidden"
                  >
                    <Label className="text-sm text-(--hl)">Name</Label>
                    <Input
                      autoFocus={!isScratchpadWorkspace}
                      placeholder="Awesome API"
                      className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) p-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                    />
                  </TextField>
                  {project &&
                    models.project.isGitProject(project) &&
                    gitRepoTreeFetcher.data && (
                      <TextField
                        name="fileName"
                        isRequired
                        value={safeToUseInsomniaFileName(fileNameValue || '')}
                        onChange={setFileNameValue}
                        validate={inputValue => {
                          const candidateFileName = safeToUseInsomniaFileNameWithExt(inputValue);
                          // Exclude the current file (normalized) so renaming to its own name isn't flagged as a collision.
                          const currentFileName = safeToUseInsomniaFileNameWithExt(fileName);
                          if (
                            selectedFolderChildren
                              .filter(name => name !== currentFileName)
                              .includes(candidateFileName)
                          ) {
                            return 'A file with the same name already exists in the selected folder';
                          }

                          return null;
                        }}
                        className="group relative flex w-full max-w-full shrink-0 flex-col gap-2 overflow-hidden"
                      >
                        <Label className="group relative flex flex-col gap-2 overflow-hidden">
                          <span className="text-sm text-(--hl)">File name</span>

                          <div className="grid w-full grid-cols-[min-content_auto] overflow-hidden rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-2 pl-2 text-(--color-font) transition-colors [grid-template-areas:'input_extension'] focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
                            <Input
                              placeholder={workspace.name ? safeToUseInsomniaFileName(workspace.name) : 'name'}
                              className="w-full outline-hidden [grid-area:input] placeholder:italic focus:outline-hidden"
                            />
                            <span className="pointer-events-none truncate opacity-0 [grid-area:input]">
                              {safeToUseInsomniaFileName(fileNameValue) ||
                                (workspace.name ? safeToUseInsomniaFileName(workspace.name) : 'name')}
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
                        onChange={setDescription}
                      />
                      <Input name="description" className="sr-only" value={description} readOnly />
                      {!models.workspace.isEnvironment(workspace) && !models.workspace.isMcp(workspace) && (
                        <>
                          <Heading>Actions</Heading>
                          <PromptButton
                            onClick={async () => {
                              const docs = await db.getWithDescendants(workspace, [models.request.type]);
                              const requests = docs.filter(models.request.isRequest);
                              for (const req of requests) {
                                await services.helpers.removeResponsesForRequest(req._id);
                              }
                              onClose();
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
                          value={mockServerUrlValue}
                          onChange={setMockServerUrlValue}
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
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </UnsavedChangesGuard>
  );
};

WorkspaceSettingsModal.displayName = 'WorkspaceSettingsModal';
