import type { StorageRules } from 'insomnia-api';
import { useEffect, useRef, useState } from 'react';
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

import type { ApiSpec, Project, WorkspaceScope } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useGitProjectRepositoryTreeLoaderFetcher } from '~/routes/git.repository-tree';
import { useWorkspaceNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.new';
import { Badge } from '~/ui/components/base/badge';
import { useAIFeatureStatus } from '~/ui/hooks/use-organization-features';

import { safeToUseInsomniaFileName, safeToUseInsomniaFileNameWithExt } from '../../../sync/git/insomnia-filename';
import { AnalyticsEvent } from '../../analytics';
import { Icon } from '../icon';

const titleByScope: Record<WorkspaceScope, string> = {
  [models.workspace.WorkspaceScopeKeys.collection]: 'Request Collection',
  [models.workspace.WorkspaceScopeKeys.environment]: 'Environment',
  [models.workspace.WorkspaceScopeKeys.mockServer]: 'Mock Server',
  [models.workspace.WorkspaceScopeKeys.design]: 'Design Document',
  [models.workspace.WorkspaceScopeKeys.mcp]: 'MCP Client',
};

const defaultNameByScope: Record<WorkspaceScope, string> = {
  [models.workspace.WorkspaceScopeKeys.collection]: 'My Collection',
  [models.workspace.WorkspaceScopeKeys.environment]: 'My Environment',
  [models.workspace.WorkspaceScopeKeys.mockServer]: 'My Mock Server',
  [models.workspace.WorkspaceScopeKeys.design]: 'My Design Document',
  [models.workspace.WorkspaceScopeKeys.mcp]: 'My MCP Client',
};

export const NewWorkspaceModal = ({
  isOpen,
  onOpenChange,
  project,
  scope,
  storageRules,
  sourceApiSpec,
  onCreateWorkspace,
  redirectAfterCreate = true,
  source,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  project: Project;
  storageRules: StorageRules;
  onCreateWorkspace?: (workspaceId: string) => void;
  redirectAfterCreate?: boolean;
  scope: WorkspaceScope;
  sourceApiSpec?: ApiSpec;
  source?: string;
}) => {
  const { organizationId } = useParams() as { organizationId: string; projectId: string };

  const isSelfHostedMockDisabled = !storageRules.enableLocalVault && !storageRules.enableGitSync;
  const isCloudMockDisabled = !project.remoteId || !storageRules.enableCloudSync;

  const { isGenerateMockServersWithAIEnabled } = useAIFeatureStatus();

  const [workspaceData, setWorkspaceData] = useState<{
    name: string;
    scope: WorkspaceScope;
    folderPath?: string;
    mockServerType?: 'self-hosted' | 'cloud';
    mockServerUrl?: string;
    mockServerCreationType?: 'ai' | 'manual';
    mockServerOASFilePath?: string;
    mockServerSpecURL?: string;
    mockServerSpecSource?: 'file' | 'url' | 'text';
    mockServerSpecText?: string;
    mockServerAdditionalFiles?: string[];
    fileName?: string;
    mockServerDynamicResponses?: boolean;
  }>({
    name: defaultNameByScope[scope],
    scope,
    folderPath: '',
    fileName: safeToUseInsomniaFileName(defaultNameByScope[scope]),
    mockServerType: isCloudMockDisabled ? 'self-hosted' : 'cloud',
    mockServerUrl: '',
    mockServerCreationType: sourceApiSpec?.contents ? 'ai' : 'manual',
    mockServerSpecSource: 'file',
    mockServerSpecText: '',
    mockServerAdditionalFiles: [],
    mockServerDynamicResponses: false,
  });

  const createNewWorkspaceFetcher = useWorkspaceNewActionFetcher();
  const prevCreateNewWorkspaceFetcherState = useRef(createNewWorkspaceFetcher.state);

  const [progressMessage, setProgressMessage] = useState(0);
  const progressMessages = ['Creating...', 'Working...', 'Building...', 'Still going...', 'Almost there...'];

  const gitRepoTreeFetcher = useGitProjectRepositoryTreeLoaderFetcher();

  useEffect(() => {
    if (createNewWorkspaceFetcher.state !== 'idle' && scope === models.workspace.WorkspaceScopeKeys.mockServer) {
      setProgressMessage(0);
      const interval = setInterval(() => {
        setProgressMessage(prev => (prev + 1) % progressMessages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
    setProgressMessage(0);

    return;
  }, [createNewWorkspaceFetcher.state, scope, progressMessages.length]);

  useEffect(() => {
    const didCreateWorkspace =
      prevCreateNewWorkspaceFetcherState.current !== 'idle' && createNewWorkspaceFetcher.state === 'idle';

    prevCreateNewWorkspaceFetcherState.current = createNewWorkspaceFetcher.state;

    if (!didCreateWorkspace || createNewWorkspaceFetcher.data?.error) {
      return;
    }

    if (
      createNewWorkspaceFetcher.data &&
      'workspaceId' in createNewWorkspaceFetcher.data &&
      createNewWorkspaceFetcher.data.workspaceId
    ) {
      onCreateWorkspace?.(createNewWorkspaceFetcher.data.workspaceId);
    }

    onOpenChange(false);
  }, [createNewWorkspaceFetcher.data, createNewWorkspaceFetcher.state, onCreateWorkspace, onOpenChange]);

  useEffect(() => {
    if (
      models.project.isGitProject(project) &&
      isOpen &&
      gitRepoTreeFetcher.state === 'idle' &&
      !gitRepoTreeFetcher.data
    ) {
      gitRepoTreeFetcher.load({ projectId: project._id });
    }
  }, [gitRepoTreeFetcher, isOpen, project]);

  useEffect(() => {
    if (isOpen && scope === models.workspace.WorkspaceScopeKeys.mockServer) {
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.mockCreateModalOpened,
      });
    }
  }, [isOpen, scope]);

  const createNewWorkspace = () => {
    createNewWorkspaceFetcher.submit({
      organizationId,
      projectId: project._id,
      ...workspaceData,
      ...(sourceApiSpec?.contents && {
        apiSpecContents: sourceApiSpec.contents,
      }),
      redirectAfterCreate,
      ...(source && { source }),
    });
  };

  // From the folderPath we need to get the folder children and validate that there is no file with the same name
  const selectedFolder = workspaceData.folderPath || gitRepoTreeFetcher.data?.repositoryTree.id || '';
  const selectedFolderChildren = gitRepoTreeFetcher.data?.folderList[selectedFolder] || [];

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable={createNewWorkspaceFetcher.state === 'idle' && gitRepoTreeFetcher.state === 'idle'}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        className={`flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) ${models.project.isGitProject(project) ? 'min-h-[420px]' : 'min-h-[220px]'}`}
      >
        <Dialog
          aria-label="Create or update dialog"
          className="grid flex-1 grid-rows-[min-content_1fr_min-content] gap-4 overflow-hidden outline-hidden"
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
                  Create a new{' '}
                  {workspaceData.scope === 'mock-server' && sourceApiSpec?.contents
                    ? `Mock Server from ${sourceApiSpec.fileName}`
                    : titleByScope[workspaceData.scope]}
                </Heading>
                <Button
                  isDisabled={createNewWorkspaceFetcher.state !== 'idle' || gitRepoTreeFetcher.state !== 'idle'}
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              <div className="flex flex-col justify-start gap-4 overflow-x-hidden overflow-y-auto px-10">
                {createNewWorkspaceFetcher.data?.error && (
                  <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
                    <Icon icon="triangle-exclamation" />
                    <span>Error: {createNewWorkspaceFetcher.data?.error}</span>
                  </div>
                )}
                <TextField
                  autoFocus
                  name="name"
                  value={workspaceData.name}
                  isRequired
                  onChange={name => setWorkspaceData({ ...workspaceData, name })}
                  className="group relative flex flex-col gap-2"
                >
                  <Label className="text-sm text-(--hl)">Name</Label>
                  <Input
                    placeholder={`Enter a name for your ${titleByScope[workspaceData.scope]}...`}
                    className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                  />
                  <FieldError className="text-xs text-red-500" />
                </TextField>
                {models.project.isGitProject(project) && (
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
                        <span className="text-sm text-(--hl)">File name</span>

                        <div className="grid w-full grid-cols-[min-content_auto] overflow-hidden rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors [grid-template-areas:'input_extension'] focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
                          <Input
                            placeholder={workspaceData.name ? safeToUseInsomniaFileName(workspaceData.name) : 'name'}
                            className="w-full min-w-[3ch] outline-hidden [grid-area:input] placeholder:italic focus:outline-hidden"
                          />
                          <span className="-z-10 w-min truncate opacity-0 [grid-area:input]">
                            {safeToUseInsomniaFileName(workspaceData.fileName || workspaceData.name || 'name')}
                          </span>
                          <span className="text-(--hl) [grid-area:extension]">.yaml</span>
                        </div>
                      </Label>
                      <FieldError className="text-xs text-red-500" />
                    </TextField>
                    <Label className="text-sm text-(--hl)">
                      Folder where the file will be saved in the repository:
                    </Label>

                    <Tree
                      className="grid max-h-52 min-h-24 gap-0 overflow-auto rounded-xs border border-solid border-(--hl-sm)"
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
                        <div className="flex h-full items-center justify-center gap-2 p-2 text-sm text-(--hl)">
                          <Icon icon="spinner" className="size-5 animate-spin" />
                          Loading files...
                        </div>
                      )}
                    >
                      {function renderItem(item) {
                        return (
                          <TreeItem
                            className="group flex flex-col rounded-xs border border-solid border-transparent px-2 py-1 pl-(--tree-item-level) outline-hidden transition-colors duration-300 odd:bg-(--hl-xxs) aria-disabled:text-(--hl) aria-selected:border-(--color-surprise) aria-selected:bg-(--hl-lg)"
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
                                <div className="flex items-center gap-2 data-[disabled=true]:text-(--hl)">
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
                        setWorkspaceData({
                          ...workspaceData,
                          mockServerCreationType: creationType as 'ai' | 'manual',
                          mockServerType: creationType === 'ai' ? 'self-hosted' : workspaceData.mockServerType,
                        });
                      }}
                      className="mb-2 flex flex-col gap-2"
                    >
                      <Label className="text-sm text-(--hl)">How do you want to create your mock server?</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="manual"
                          isDisabled={!!sourceApiSpec?.contents}
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
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
                        <Radio
                          value="ai"
                          isDisabled={!isGenerateMockServersWithAIEnabled}
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                        >
                          <div className="flex items-center gap-2">
                            <Heading className="text-lg font-bold">
                              <Badge color="surprise" icon="sparkles" label="AI" />
                              <span>Auto Generate</span>
                            </Heading>
                          </div>
                          <p className="pt-2">
                            {!isGenerateMockServersWithAIEnabled
                              ? 'Enable generating mock servers with AI in Insomnia Preferences → AI Settings to use this feature.'
                              : 'Automatically generate a mock server from an OpenAPI spec.'}
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>

                    {workspaceData.mockServerCreationType === 'ai' && (
                      <div className="mb-4">
                        <Label className="mb-2 block text-sm text-(--hl)">
                          What should Insomnia generate your mock server from?
                        </Label>
                        {sourceApiSpec?.contents ? (
                          <div className="flex items-center gap-2 rounded-sm border border-(--hl-md) bg-(--hl-xs) p-3">
                            <Icon icon="file-code" className="text-(--hl)" />
                            <span className="text-sm text-(--color-font)">
                              Using {sourceApiSpec.fileName} OpenAPI specification
                            </span>
                          </div>
                        ) : (
                          <>
                            <RadioGroup
                              name="mockServerSpecSource"
                              defaultValue={workspaceData.mockServerSpecSource}
                              onChange={source => {
                                setWorkspaceData({
                                  ...workspaceData,
                                  mockServerSpecSource: source as 'file' | 'url' | 'text',
                                });
                              }}
                              className="mb-3 flex flex-col gap-2"
                              aria-label="Select source for mock server generation"
                            >
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                <Radio
                                  value="file"
                                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-3 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon icon="file" />
                                    <span className="font-medium">OpenAPI File</span>
                                  </div>
                                  <p className="mt-1 text-sm text-(--hl)">
                                    Upload an OpenAPI specification (JSON or YAML)
                                  </p>
                                </Radio>
                                <Radio
                                  value="url"
                                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-3 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon icon="link" />
                                    <span className="font-medium">URL</span>
                                  </div>
                                  <p className="mt-1 text-sm text-(--hl)">Provide a URL to API documentation</p>
                                </Radio>
                                <Radio
                                  value="text"
                                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-3 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon icon="file-text" />
                                    <span className="font-medium">Text</span>
                                  </div>
                                  <p className="mt-1 text-sm text-(--hl)">Provide a description of the API endpoints</p>
                                </Radio>
                              </div>
                            </RadioGroup>

                            {workspaceData.mockServerSpecSource === 'file' && (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  onPress={async () => {
                                    const result = await window.dialog.showOpenDialog({
                                      filters: [{ name: 'OpenAPI Files', extensions: ['yaml', 'yml', 'json'] }],
                                      properties: ['openFile'],
                                    });
                                    if (!result.canceled && result.filePaths.length > 0) {
                                      setWorkspaceData({
                                        ...workspaceData,
                                        mockServerOASFilePath: result.filePaths[0],
                                      });
                                    }
                                  }}
                                  className="rounded-sm border border-(--hl-md) bg-(--color-bg) px-4 py-2 text-(--color-font) hover:bg-(--hl-xs)"
                                >
                                  Choose File
                                </Button>
                                <span className="flex-1 text-sm text-(--hl)">
                                  {workspaceData.mockServerOASFilePath
                                    ? workspaceData.mockServerOASFilePath.split('/').pop()
                                    : 'No file selected'}
                                </span>
                              </div>
                            )}

                            {workspaceData.mockServerSpecSource === 'url' && (
                              <TextField
                                name="mockServerSpecURL"
                                value={workspaceData.mockServerSpecURL || ''}
                                onChange={url => setWorkspaceData({ ...workspaceData, mockServerSpecURL: url })}
                                className="group relative flex flex-col gap-2"
                              >
                                <Input
                                  placeholder="https://api.example.com"
                                  aria-label="API documentation URL"
                                  className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                                />
                              </TextField>
                            )}

                            {workspaceData.mockServerSpecSource === 'text' && (
                              <TextField
                                name="mockServerSpecText"
                                value={workspaceData.mockServerSpecText || ''}
                                onChange={text => setWorkspaceData({ ...workspaceData, mockServerSpecText: text })}
                                className="group relative flex flex-col gap-2"
                              >
                                <textarea
                                  placeholder="Describe your API..."
                                  aria-label="API description text"
                                  className="resize-vertical min-h-32 w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-2 pr-2 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                                  value={workspaceData.mockServerSpecText || ''}
                                  onChange={e =>
                                    setWorkspaceData({ ...workspaceData, mockServerSpecText: e.target.value })
                                  }
                                />
                              </TextField>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {workspaceData.mockServerCreationType === 'ai' && (
                      <div className="mb-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Label className="text-sm text-(--hl)">Should your mock server use dynamic responses?</Label>
                          <div className="group relative">
                            <Icon icon="info-circle" className="cursor-help text-(--hl)" />
                            <div className="absolute top-full left-1/2 z-10 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-(--hl-sm) bg-(--color-bg) p-3 text-xs text-(--color-font) shadow-lg group-hover:block">
                              Insomnia can generate a mock server that will use liquid templates in the mock response
                              bodies. These templates can be used to dynamically populate response data using request
                              data and/or faker functions.
                            </div>
                          </div>
                        </div>
                        <RadioGroup
                          name="mockServerDynamicResponses"
                          value={workspaceData.mockServerDynamicResponses ? 'yes' : 'no'}
                          onChange={value => {
                            setWorkspaceData({
                              ...workspaceData,
                              mockServerDynamicResponses: value === 'yes',
                            });
                          }}
                          className="flex gap-2"
                          aria-label="Use dynamic responses in mock server"
                        >
                          <Radio
                            value="no"
                            className="flex-1 rounded-sm border border-solid border-(--hl-md) p-3 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                          >
                            <span className="font-medium">No</span>
                          </Radio>
                          <Radio
                            value="yes"
                            className="flex-1 rounded-sm border border-solid border-(--hl-md) p-3 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                          >
                            <span className="font-medium">Yes</span>
                          </Radio>
                        </RadioGroup>
                      </div>
                    )}

                    {workspaceData.mockServerCreationType === 'ai' && (
                      <div className="mb-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Label className="text-sm text-(--hl)">Do you want to provide any additional files?</Label>
                          <div className="group relative">
                            <Icon icon="info-circle" className="cursor-help text-(--hl)" />
                            <div className="absolute top-full left-1/2 z-10 mt-2 hidden w-72 -translate-x-1/2 rounded-md border border-(--hl-sm) bg-(--color-bg) p-3 text-xs text-(--color-font) shadow-lg group-hover:block">
                              Add files to include as additional context for the LLM when generating your mock server.
                              These files can contain example data, schemas, or other relevant information.
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Button
                            type="button"
                            onPress={async () => {
                              const result = await window.dialog.showOpenDialog({
                                filters: [{ name: 'Files', extensions: ['json', 'yaml', 'yml', 'txt'] }],
                                properties: ['openFile', 'multiSelections'],
                              });
                              if (!result.canceled && result.filePaths.length > 0) {
                                const currentFiles = workspaceData.mockServerAdditionalFiles || [];
                                const newFiles = [...currentFiles, ...result.filePaths];
                                setWorkspaceData({ ...workspaceData, mockServerAdditionalFiles: newFiles });
                              }
                            }}
                            className="flex items-center gap-2 rounded-sm border border-(--hl-md) bg-(--color-bg) px-4 py-2 text-(--color-font) hover:bg-(--hl-xs)"
                          >
                            <Icon icon="plus" />
                            Add Files
                          </Button>

                          {workspaceData.mockServerAdditionalFiles &&
                            workspaceData.mockServerAdditionalFiles.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs text-(--hl)">
                                  {workspaceData.mockServerAdditionalFiles.length} file(s) selected:
                                </p>
                                <div className="max-h-32 space-y-1 overflow-y-auto">
                                  {workspaceData.mockServerAdditionalFiles.map((filePath, index) => (
                                    <div
                                      key={filePath}
                                      className="flex items-center justify-between rounded-sm bg-(--hl-xs) p-2 text-sm"
                                    >
                                      <span className="flex-1 truncate">{filePath.split('/').pop()}</span>
                                      <Button
                                        type="button"
                                        aria-label={`Remove ${filePath.split('/').pop()} from additional context files`}
                                        onPress={() => {
                                          const newFiles = workspaceData.mockServerAdditionalFiles!.filter(
                                            (_, i) => i !== index,
                                          );
                                          setWorkspaceData({
                                            ...workspaceData,
                                            mockServerAdditionalFiles: newFiles,
                                          });
                                        }}
                                        className="ml-2 text-(--hl) hover:text-red-500"
                                      >
                                        <Icon icon="x" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                    <RadioGroup
                      name="mockServerType"
                      value={workspaceData.mockServerType}
                      onChange={serverType => {
                        setWorkspaceData({ ...workspaceData, mockServerType: serverType as 'self-hosted' | 'cloud' });
                      }}
                      className="mb-2 flex flex-col gap-2"
                    >
                      <Label className="text-sm text-(--hl)">How do you want to host your mock server?</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="cloud"
                          isDisabled={isCloudMockDisabled || workspaceData.mockServerCreationType === 'ai'}
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Mock</Heading>
                          </div>
                          <p className="pt-2">
                            {workspaceData.mockServerCreationType === 'ai'
                              ? 'Not available when creating with Auto Generate.'
                              : isCloudMockDisabled
                                ? 'Only available for cloud projects'
                                : 'Runs on Insomnia cloud, ideal for collaboration.'}
                          </p>
                        </Radio>
                        <Radio
                          value="self-hosted"
                          isDisabled={isSelfHostedMockDisabled}
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
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
                    <div className="-mt-2 flex items-center gap-2 text-sm">
                      <Icon icon="info-circle" />
                      <span>
                        To learn more about self hosting{' '}
                        <Link href="https://docs.insomnia.rest/insomnia/api-mocking" className="underline">
                          click here
                        </Link>
                      </span>
                    </div>
                    {workspaceData.mockServerType === 'self-hosted' && (
                      <TextField
                        name="mockServerUrl"
                        value={workspaceData.mockServerUrl}
                        onChange={url => setWorkspaceData({ ...workspaceData, mockServerUrl: url })}
                        className="group relative flex flex-1 flex-col gap-2"
                      >
                        <Label className="text-sm text-(--hl)">What is your self-hosted mock server URL?</Label>
                        <Input
                          placeholder="https://example.com"
                          className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                        />
                      </TextField>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 p-10">
                <Button
                  onPress={close}
                  isDisabled={createNewWorkspaceFetcher.state !== 'idle' || gitRepoTreeFetcher.state !== 'idle'}
                  className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isDisabled={createNewWorkspaceFetcher.state !== 'idle' || gitRepoTreeFetcher.state !== 'idle'}
                  className="flex min-w-[10ch] items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-center text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                >
                  {createNewWorkspaceFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                  <span>
                    {createNewWorkspaceFetcher.state !== 'idle' &&
                    scope === models.workspace.WorkspaceScopeKeys.mockServer
                      ? progressMessages[progressMessage]
                      : 'Create'}
                  </span>
                </Button>
              </div>
            </Form>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
