import React, { useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Dialog,
  FieldError,
  Form,
  Heading,
  Input,
  Label,
  Link,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  TextField,
  Tree,
  TreeItem,
  TreeItemContent,
} from 'react-aria-components';
import { useParams } from 'react-router';

import type { StorageRules } from '~/models/organization';
import { useGitProjectRepositoryTreeLoaderFetcher } from '~/routes/git.repository-tree';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';

import { type ApiSpec } from '../../../models/api-spec';
import { isGitProject, type Project } from '../../../models/project';
import { type WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';
import { safeToUseInsomniaFileName, safeToUseInsomniaFileNameWithExt } from '../../../sync/git/insomnia-filename';
import { Icon } from '../icon';

const titleByScope: Record<WorkspaceScope, string> = {
  [WorkspaceScopeKeys.collection]: 'Request Collection',
  [WorkspaceScopeKeys.environment]: 'Environment',
  [WorkspaceScopeKeys.mockServer]: 'Mock Server',
  [WorkspaceScopeKeys.design]: 'Design Document',
};

const defaultNameByScope: Record<WorkspaceScope, string> = {
  [WorkspaceScopeKeys.collection]: 'My Collection',
  [WorkspaceScopeKeys.environment]: 'My Environment',
  [WorkspaceScopeKeys.mockServer]: 'My Mock Server',
  [WorkspaceScopeKeys.design]: 'My Design Document',
};

export const NewWorkspaceModal = ({
  isOpen,
  onOpenChange,
  project,
  scope,
  storageRules,
  currentPlan,
  sourceApiSpec,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  project: Project;
  storageRules: StorageRules;
  currentPlan?: { type: string };
  scope: WorkspaceScope;
  sourceApiSpec?: ApiSpec;
}) => {
  const { organizationId } = useParams() as { organizationId: string; projectId: string };

  const isLocalProject = !project.remoteId;
  const isEnterprise = currentPlan?.type.includes('enterprise');
  const isSelfHostedDisabled = !isEnterprise || !storageRules.enableLocalVault;
  const isCloudProjectDisabled = isLocalProject || !storageRules.enableCloudSync;

  const canOnlyCreateSelfHosted = isLocalProject && isEnterprise;

  const [workspaceData, setWorkspaceData] = useState<{
    name: string;
    scope: WorkspaceScope;
    folderPath?: string;
    mockServerType?: 'self-hosted' | 'cloud';
    mockServerUrl?: string;
    mockServerCreationType?: 'ai' | 'manual';
    openApiSpecPath?: string;
    fileName?: string;
    mockServerDynamicResponses?: boolean;
  }>({
    name: defaultNameByScope[scope],
    scope,
    folderPath: '',
    fileName: safeToUseInsomniaFileName(defaultNameByScope[scope]),
    mockServerType: canOnlyCreateSelfHosted ? 'self-hosted' : 'cloud',
    mockServerUrl: '',
    mockServerCreationType: 'ai',
    mockServerDynamicResponses: false,
  });

  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();

  const gitRepoTreeFetcher = useGitProjectRepositoryTreeLoaderFetcher();

  useEffect(() => {
    if (isGitProject(project) && isOpen && gitRepoTreeFetcher.state === 'idle' && !gitRepoTreeFetcher.data) {
      gitRepoTreeFetcher.load({ projectId: project._id });
    }
  }, [gitRepoTreeFetcher, isOpen, project]);

  const createNewWorkspace = () => {
    createNewWorkspaceFetcher.submit({
      organizationId,
      projectId: project._id,
      ...workspaceData,
      ...(sourceApiSpec?.contents && {
        apiSpecContents: sourceApiSpec.contents,
      }),
    });
  };

  // From the folderPath we need to get the folder children and validate that there is no file with the same name
  const selectedFolder = workspaceData.folderPath || gitRepoTreeFetcher.data?.repositoryTree.id || '';
  const selectedFolderChildren = gitRepoTreeFetcher.data?.folderList[selectedFolder] || [];

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        className={`flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] ${isGitProject(project) ? 'min-h-[420px]' : 'min-h-[220px]'}`}
      >
        <Dialog
          aria-label="Create or update dialog"
          className="grid flex-1 gap-4 overflow-hidden outline-none [grid-template-rows:min-content_1fr_min-content]"
        >
          {({ close }) => (
            <Form
              validationBehavior="native"
              className="contents"
              onSubmit={e => {
                e.preventDefault();

                const isValid = e.currentTarget.checkValidity();

                if (isValid) {
                  createNewWorkspace();
                }
              }}
            >
              <div className="flex items-center justify-between gap-2 px-10 pt-10">
                <Heading slot="title" className="text-2xl">
                  Create a new {workspaceData.scope === 'mock-server' && sourceApiSpec?.contents
                    ? `Mock Server from ${sourceApiSpec.fileName}`
                    : titleByScope[workspaceData.scope]}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              {createNewWorkspaceFetcher.data?.error && (
                <div className="px-10">
                  <div className="flex items-center gap-2 rounded-sm bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-[--color-font-danger]">
                    <Icon icon="triangle-exclamation" />
                    <span>
                      Error:
                      {createNewWorkspaceFetcher.data?.error}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col justify-start gap-4 overflow-y-auto overflow-x-hidden px-10">
                <TextField
                  autoFocus
                  name="name"
                  value={workspaceData.name}
                  isRequired
                  onChange={name => setWorkspaceData({ ...workspaceData, name })}
                  className="group relative flex flex-col gap-2"
                >
                  <Label className="text-sm text-[--hl]">Name</Label>
                  <Input
                    placeholder={`Enter a name for your ${titleByScope[workspaceData.scope]}...`}
                    className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                  />
                  <FieldError className="text-xs text-red-500" />
                </TextField>
                {isGitProject(project) && (
                  <>
                    <TextField
                      name="fileName"
                      isRequired
                      validate={fileName => {
                        if (selectedFolderChildren.includes(safeToUseInsomniaFileNameWithExt(fileName))) {
                          return 'A file with the same name already exists in the selected folder';
                        }

                        return null;
                      }}
                      value={safeToUseInsomniaFileName(workspaceData.fileName || '')}
                      onChange={fileName => setWorkspaceData({ ...workspaceData, fileName })}
                      className="group relative flex max-w-full flex-col gap-2 overflow-hidden"
                    >
                      <Label className="group relative flex flex-col gap-2 overflow-hidden">
                        <span className="text-sm text-[--hl]">File name</span>

                        <div className="grid w-full overflow-hidden rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors [grid-template-areas:'input_extension'] [grid-template-columns:min-content_auto] focus:outline-none focus:ring-1 focus:ring-[--hl-md]">
                          <Input
                            placeholder={workspaceData.name ? safeToUseInsomniaFileName(workspaceData.name) : 'name'}
                            className="w-full min-w-[3ch] outline-none [grid-area:input] placeholder:italic focus:outline-none"
                          />
                          <span className="-z-10 w-min truncate opacity-0 [grid-area:input]">
                            {safeToUseInsomniaFileName(workspaceData.fileName || workspaceData.name || 'name')}
                          </span>
                          <span className="text-[--hl] [grid-area:extension]">.yaml</span>
                        </div>
                      </Label>
                      <FieldError className="text-xs text-red-500" />
                    </TextField>
                    <Label className="text-sm text-[--hl]">
                      Folder where the file will be saved in the repository:
                    </Label>

                    <Tree
                      className="grid max-h-52 gap-0 overflow-auto rounded-sm border border-solid border-[--hl-sm]"
                      defaultSelectedKeys={[gitRepoTreeFetcher.data?.repositoryTree.id || '']}
                      disallowEmptySelection
                      defaultExpandedKeys={[gitRepoTreeFetcher.data?.repositoryTree.id || '']}
                      onSelectionChange={selection => {
                        if (selection !== 'all') {
                          setWorkspaceData({
                            ...workspaceData,
                            folderPath: selection.values().next().value as string,
                          });
                        }
                      }}
                      aria-label="Files"
                      selectionMode="single"
                      items={gitRepoTreeFetcher.data?.repositoryTree ? [gitRepoTreeFetcher.data?.repositoryTree] : []}
                      renderEmptyState={() => (
                        <div className="flex h-full items-center justify-center gap-2 p-2 text-sm text-[--hl]">
                          <Icon icon="spinner" className="size-5 animate-spin" />
                          Loading files...
                        </div>
                      )}
                    >
                      {function renderItem(item) {
                        return (
                          <TreeItem
                            className="group flex flex-col rounded-sm border border-solid border-transparent px-2 py-1 pl-[--tree-item-level] outline-none transition-colors duration-300 odd:bg-[--hl-xxs] aria-disabled:text-[--hl] aria-selected:border-[--color-surprise] aria-selected:bg-[--hl-lg]"
                            style={{
                              // @ts-expect-error --tree-item-level is a custom property
                              '--tree-item-level': `${(item.type === 'root' ? 0 : item.id.split('/').length * 1) + 0.5}rem`,
                              'color': item.type === 'file' ? 'var(--hl)' : 'var(--color-font)',
                            }}
                            isDisabled={item.type === 'file'}
                            textValue={item.name}
                          >
                            <TreeItemContent>
                              {({ isExpanded }) => (
                                <div className="flex items-center gap-2 data-[disabled=true]:text-[--hl]">
                                  {'children' in item ? (
                                    item.children.length ? (
                                      <Button slot="chevron">
                                        <Icon className="size-4" icon={isExpanded ? 'folder-open' : 'folder'} />
                                      </Button>
                                    ) : (
                                      <Icon icon={'folder-blank'} />
                                    )
                                  ) : (
                                    <Icon icon={'file'} />
                                  )}
                                  {item.name}
                                </div>
                              )}
                            </TreeItemContent>
                            {item.type !== 'file' && <Collection items={item.children}>{renderItem}</Collection>}
                          </TreeItem>
                        );
                      }}
                    </Tree>
                  </>
                )}
                {workspaceData.scope === 'mock-server' && (
                  <>
                    <RadioGroup
                      name="mockServerCreationType"
                      defaultValue={workspaceData.mockServerCreationType}
                      onChange={creationType => {
                        setWorkspaceData({ ...workspaceData, mockServerCreationType: creationType as 'ai' | 'manual' });
                      }}
                      className="flex flex-col gap-2 mb-2"
                    >
                      <Label className="text-sm text-[--hl]">How do you want to create your mock server?</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="ai"
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="robot" />
                            <Heading className="text-lg font-bold">Auto Generate</Heading>
                          </div>
                          <p className="pt-2">
                            Automatically generate a mock server from an OpenAPI spec.
                          </p>
                        </Radio>
                        <Radio
                          value="manual"
                          isDisabled={!!sourceApiSpec?.contents}
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="wrench" />
                            <Heading className="text-lg font-bold">Start from Scratch</Heading>
                          </div>
                          <p className="pt-2">
                            {sourceApiSpec?.contents
                              ? 'Not available when creating from a design document'
                              : 'Create an empty mock server.'}
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>

                    {workspaceData.mockServerCreationType === 'ai' && (
                      <div className="mb-4">
                        <Label className="text-sm text-[--hl] mb-2 block">What should Insomnia generate your mock server from?</Label>
                        <p className="text-sm text-[--hl] mb-3">
                          OpenAPI Spec (JSON or YAML)
                        </p>
                        {sourceApiSpec?.contents ? (
                          <div className="flex items-center gap-2 p-3 border border-[--hl-md] rounded bg-[--hl-xs]">
                            <Icon icon="file-code" className="text-[--hl]" />
                            <span className="text-sm text-[--color-font]">
                              Using {sourceApiSpec.fileName} OpenAPI specification
                            </span>
                          </div>
                        ) : (
                          <div className="flex gap-2 items-center">
                            <Button
                              type="button"
                              onPress={async () => {
                                const result = await window.dialog.showOpenDialog({
                                  filters: [
                                    { name: 'OpenAPI Files', extensions: ['yaml', 'yml', 'json'] }
                                  ],
                                  properties: ['openFile']
                                });
                                if (!result.canceled && result.filePaths.length > 0) {
                                  setWorkspaceData({...workspaceData, openApiSpecPath: result.filePaths[0]});
                                }
                              }}
                              className="px-4 py-2 border border-[--hl-md] rounded bg-[--color-bg] text-[--color-font] hover:bg-[--hl-xs]"
                            >
                              Choose File
                            </Button>
                            <span className="text-sm text-[--hl] flex-1">
                              {workspaceData.openApiSpecPath ? workspaceData.openApiSpecPath.split('/').pop(): 'No file selected'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {workspaceData.mockServerCreationType === 'ai' && (
                      <div className="mb-4 flex items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm text-[--hl]">
                              Should your mock server use dynamic responses?
                            </Label>
                            <div className="group relative">
                              <Icon icon="info-circle" className="text-[--hl] cursor-help" />
                              <div className="absolute left-1/2 top-full mt-2 hidden w-72 -translate-x-1/2 rounded-md bg-[--color-bg] border border-[--hl-sm] p-3 text-xs text-[--color-font] shadow-lg group-hover:block z-10">
                                Insomnia can generate a mock server that will use liquid templates in the mock response bodies. These templates can be used to dynamically populate response data using request data and/or faker functions.
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1">
                          <Button
                            onPress={() => {
                              setWorkspaceData({ ...workspaceData, mockServerDynamicResponses: !workspaceData.mockServerDynamicResponses });
                            }}
                            className={`w-full rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none ${
                              workspaceData.mockServerDynamicResponses
                                ? 'border-[--color-surprise] ring-2 ring-[--color-surprise]'
                                : ''
                            }`}
                          >
                            <p>Yes</p>
                          </Button>
                        </div>
                      </div>
                    )}

                    <RadioGroup
                      name="mockServerType"
                      defaultValue={workspaceData.mockServerType}
                      onChange={serverType => {
                        setWorkspaceData({ ...workspaceData, mockServerType: serverType as 'self-hosted' | 'cloud' });
                      }}
                      className="flex flex-col gap-2 mb-2"
                    >
                      <Label className="text-sm text-[--hl]">How do you want to host your mock server?</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="cloud"
                          isDisabled={isCloudProjectDisabled || workspaceData.mockServerCreationType === 'ai'}
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          </div>
                          <p className="pt-2">
                            {workspaceData.mockServerCreationType === 'ai'
                              ? 'Not available when creating with Auto Generate.'
                              : isCloudProjectDisabled
                              ? 'Only available for cloud projects'
                              : 'Runs on Insomnia cloud, ideal for collaboration.'}
                          </p>
                        </Radio>
                        <Radio
                          value="self-hosted"
                          isDisabled={isSelfHostedDisabled}
                          className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="server" />
                            <Heading className="text-lg font-bold">Self Hosted Mock</Heading>
                          </div>
                          <p className="pt-2">
                            Runs locally or on your infrastructure, ideal for private usage and lower latency.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                    <div className="flex items-center gap-2 text-sm -mt-2">
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
                        name="mockServerUrl"
                        value={workspaceData.mockServerUrl}
                        onChange={url => setWorkspaceData({ ...workspaceData, mockServerUrl: url })}
                        className={`group relative flex flex-1 flex-col gap-2 ${workspaceData.mockServerType === 'cloud' ? 'disabled' : ''}`}
                      >
                        <Label className="text-sm text-[--hl]">Self-hosted mock server URL</Label>
                        <Input
                          disabled={workspaceData.mockServerType === 'cloud'}
                          placeholder={workspaceData.mockServerType === 'cloud' ? '' : 'https://example.com'}
                          className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                        />
                      </TextField>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-10">
                <div className="flex items-center gap-2">
                  <Button
                    onPress={close}
                    isDisabled={createNewWorkspaceFetcher.state !== 'idle' || gitRepoTreeFetcher.state !== 'idle'}
                    className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    isDisabled={createNewWorkspaceFetcher.state !== 'idle' || gitRepoTreeFetcher.state !== 'idle'}
                    className="flex w-[10ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-center text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
                  >
                    {createNewWorkspaceFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                    <span>Create</span>
                  </Button>
                </div>
              </div>
            </Form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
