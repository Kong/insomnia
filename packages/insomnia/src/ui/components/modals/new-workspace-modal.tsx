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
  UNSTABLE_Tree as Tree,
  UNSTABLE_TreeItem as TreeItem,
  UNSTABLE_TreeItemContent as TreeItemContent,
} from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { isGitProject, ORG_STORAGE_RULE, type Project } from '../../../models/project';
import { type WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';
import { safeToUseInsomniaFileName, safeToUseInsomniaFileNameWithExt } from '../../routes/actions';
import type { GetRepositoryDirectoryTreeResult } from '../../routes/git-project-actions';
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
  storageRule,
  currentPlan,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  project: Project;
    storageRule: ORG_STORAGE_RULE;
    currentPlan?: { type: string };
  scope: WorkspaceScope;
}) => {
  const { organizationId } = useParams() as { organizationId: string; projectId: string };

  const isLocalProject = !project.remoteId;
  const isEnterprise = currentPlan?.type.includes('enterprise');
  const isSelfHostedDisabled = !isEnterprise || storageRule === ORG_STORAGE_RULE.CLOUD_ONLY;
  const isCloudProjectDisabled = isLocalProject || storageRule === ORG_STORAGE_RULE.LOCAL_ONLY;

  const canOnlyCreateSelfHosted = isLocalProject && isEnterprise;

  const [workspaceData, setWorkspaceData] = useState<{
    name: string;
    scope: WorkspaceScope;
    folderPath?: string;
    mockServerType?: 'self-hosted' | 'cloud';
    mockServerUrl?: string;
    fileName?: string;
  }>({
    name: defaultNameByScope[scope],
    scope,
    folderPath: '',
    fileName: safeToUseInsomniaFileName(defaultNameByScope[scope]),
    mockServerType: canOnlyCreateSelfHosted ? 'self-hosted' : 'cloud',
    mockServerUrl: '',
  });

  const createNewWorkspaceFetcher = useFetcher<{ error?: string }>();

  const gitRepoTreeFetcher = useFetcher<GetRepositoryDirectoryTreeResult>();

  useEffect(() => {
    if (isGitProject(project) && isOpen && gitRepoTreeFetcher.state === 'idle' && !gitRepoTreeFetcher.data) {
      gitRepoTreeFetcher.load(`/organization/${organizationId}/project/${project._id}/git/repository-tree`);
    }
  }, [gitRepoTreeFetcher, isOpen, organizationId, project]);

  const createNewWorkspace = () => {
    createNewWorkspaceFetcher.submit(
      workspaceData,
      {
        action: `/organization/${organizationId}/project/${project._id}/workspace/new`,
        method: 'POST',
      }
    );
  };

  // From the folderPath we need to get the folder children and validate that there is no file with the same name
  const selectedFolder = workspaceData.folderPath || gitRepoTreeFetcher.data?.repositoryTree.id || '';
  const selectedFolderChildren = gitRepoTreeFetcher.data?.folderList[selectedFolder] || [];

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        className={`max-w-3xl w-full rounded-md border border-solid border-[--hl-sm] max-h-[90dvh] bg-[--color-bg] text-[--color-font] flex flex-col overflow-hidden ${isGitProject(project) ? 'min-h-[420px]' : 'min-h-[220px]'}`}
      >
        <Dialog
          aria-label='Create or update dialog'
          className="outline-none flex-1 gap-4 grid [grid-template-rows:min-content_1fr_min-content] overflow-hidden"
        >
          {({ close }) => (
            <Form
              validationBehavior='native'
              className='contents'
              onSubmit={e => {
                e.preventDefault();

                const isValid = e.currentTarget.checkValidity();

                if (isValid) {
                  createNewWorkspace();
                }
              }}
            >
              <div className='pt-10 px-10 flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Create a new {titleByScope[workspaceData.scope]}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              {createNewWorkspaceFetcher.data?.error && (
                <div className='px-10'>
                  <div className="flex items-center px-2 py-1 gap-2 text-sm rounded-sm text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]">
                    <Icon icon="triangle-exclamation" />
                    <span>
                      Error:
                      {createNewWorkspaceFetcher.data?.error}
                    </span>
                  </div>
                </div>
              )}

              <div className='flex flex-col justify-start gap-2 overflow-y-auto overflow-x-hidden px-10'>
                <TextField
                  autoFocus
                  name="name"
                  value={workspaceData.name}
                  isRequired
                  onChange={name => setWorkspaceData({ ...workspaceData, name })}
                  className="group relative flex flex-col gap-2"
                >
                  <Label className='text-sm text-[--hl]'>
                    Name
                  </Label>
                  <Input
                    placeholder={`Enter a name for your ${titleByScope[workspaceData.scope]}...`}
                    className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  />
                  <FieldError className='text-red-500 text-xs' />
                </TextField>
                {isGitProject(project) && gitRepoTreeFetcher.data && (
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
                      className="group relative flex flex-col gap-2 overflow-hidden max-w-full"
                    >
                      <Label className="group relative flex flex-col gap-2 overflow-hidden">
                        <span className='text-sm text-[--hl]'>
                          File name
                        </span>

                        <div className="overflow-hidden grid [grid-template-columns:min-content_auto] [grid-template-areas:'input_extension'] focus:outline-none py-1 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:ring-1 focus:ring-[--hl-md] transition-colors">
                          <Input
                            placeholder={workspaceData.name ? safeToUseInsomniaFileName(workspaceData.name) : 'name'}
                            className="[grid-area:input] placeholder:italic outline-none focus:outline-none w-full min-w-[3ch]"
                          />
                          <span className='[grid-area:input] -z-10 opacity-0 truncate w-min'>{safeToUseInsomniaFileName(workspaceData.fileName || workspaceData.name || 'name')}</span>
                          <span className='[grid-area:extension] text-[--hl]'>.yaml</span>
                      </div>
                      </Label>
                      <FieldError className='text-red-500 text-xs' />
                    </TextField>
                    <Label className="text-sm text-[--hl]">
                      Folder where the file will be saved in the repository:
                    </Label>
                    <Tree
                      className="grid gap-0 max-h-52 overflow-auto rounded-sm border border-solid border-[--hl-sm]"
                      defaultSelectedKeys={[gitRepoTreeFetcher.data.repositoryTree.id]}
                      disallowEmptySelection
                      defaultExpandedKeys={[gitRepoTreeFetcher.data.repositoryTree.id]}
                      onSelectionChange={selection => {
                        if (selection !== 'all') {
                          setWorkspaceData({ ...workspaceData, folderPath: selection.values().next().value as string });
                        }
                      }}
                      aria-label="Files"
                      selectionMode="single"
                      items={[gitRepoTreeFetcher.data.repositoryTree]}
                    >
                      {function renderItem(item) {
                        return (
                          <TreeItem
                            className="group flex odd:bg-[--hl-xxs] flex-col pl-[--tree-item-level] aria-selected:bg-[--hl-lg] aria-disabled:text-[--hl] outline-none border border-solid border-transparent aria-selected:border-[--color-surprise] rounded-sm px-2 py-1 transition-colors duration-300"
                            style={{
                              // @ts-expect-error --tree-item-level is a custom property
                              '--tree-item-level': `${(item.type === 'root' ? 0 : item.id.split('/').length * 1) + 0.5}rem`,
                              color: item.type === 'file' ? 'var(--hl)' : 'var(--color-font)',
                            }}
                            isDisabled={item.type === 'file'}
                            textValue={item.name}
                          >
                            <TreeItemContent>
                              {({ isExpanded }) => (
                                <div className='flex items-center gap-2 data-[disabled=true]:text-[--hl]'>
                                  {'children' in item ? item.children.length ? <Button slot="chevron">
                                    <Icon className='size-4' icon={isExpanded ? 'folder-open' : 'folder'} />
                                  </Button> : <Icon icon={'folder-blank'} /> : <Icon icon={'file'} />}
                                  {item.name}
                                </div>
                              )}
                            </TreeItemContent>
                            {item.type !== 'file' && (
                              <Collection items={item.children}>
                                {renderItem}
                              </Collection>
                            )}
                          </TreeItem>
                        );
                      }}
                    </Tree>
                  </>
                )}
                {workspaceData.scope === 'mock-server' && (<>
                  <RadioGroup
                    name="mockServerType"
                    defaultValue={workspaceData.mockServerType}
                    onChange={serverType => {
                      setWorkspaceData({ ...workspaceData, mockServerType: serverType as 'self-hosted' | 'cloud' });
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
                          {isCloudProjectDisabled ? 'Only available for cloud projects' : 'Runs on Insomnia cloud, ideal for collaboration.'}
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
                  </RadioGroup>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon icon="info-circle" />
                    <span>
                      To learn more about self hosting <Link href="https://docs.insomnia.rest/insomnia/api-mocking" className='underline'>click here</Link>
                    </span>
                  </div>
                  {!isSelfHostedDisabled && (
                    <TextField
                      name="mockServerUrl"
                      value={workspaceData.mockServerUrl}
                      onChange={url => setWorkspaceData({ ...workspaceData, mockServerUrl: url })}
                      className={`group relative flex-1 flex flex-col gap-2 ${workspaceData.mockServerType === 'cloud' ? 'disabled' : ''}`}
                    >
                      <Label className='text-sm text-[--hl]'>
                        Self-hosted mock server URL
                      </Label>
                      <Input
                        disabled={workspaceData.mockServerType === 'cloud'}
                        placeholder={workspaceData.mockServerType === 'cloud' ? '' : 'https://example.com'}
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                    </TextField>
                  )}
                </>
                )}
              </div>
              <div className="flex justify-end gap-2 items-center p-10">
                <div className='flex items-center gap-2'>
                  <Button
                    onPress={close}
                    className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type='submit'
                    className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                  >
                    Create
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
