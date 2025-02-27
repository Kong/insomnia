import React, { useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Dialog,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
  UNSTABLE_Tree as Tree,
  UNSTABLE_TreeItem as TreeItem,
  UNSTABLE_TreeItemContent as TreeItemContent,
} from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { isGitProject, type Project } from '../../../models/project';
import { type WorkspaceScope, WorkspaceScopeKeys } from '../../../models/workspace';
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
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  project: Project;
  scope: WorkspaceScope;
}) => {
  const { organizationId } = useParams() as { organizationId: string; projectId: string };
  const [workspaceData, setWorkspaceData] = useState<{
    name: string;
    scope: WorkspaceScope;
    folderPath?: string;
  }>({
    name: '',
    scope,
    folderPath: '',
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
      {
        name: workspaceData.name,
        scope: workspaceData.scope,
        folderPath: workspaceData.folderPath,
      },
      {
        action: `/organization/${organizationId}/project/${project._id}/workspace/new`,
        method: 'POST',
      }
    );
  };

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
          className="outline-none flex-1 gap-4 grid [grid-template-rows:min-content_1fr_min-content]"
        >
          {({ close }) => (
            <>
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

              <div className='flex flex-col justify-start gap-2 overflow-y-auto px-10'>
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
                    defaultValue={defaultNameByScope[workspaceData.scope]}
                    className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  />
                </TextField>
                {isGitProject(project) && gitRepoTreeFetcher.data && (
                  <>
                    <Label className="text-sm text-[--hl]">
                      Folder where the file will be saved in the repository:
                    </Label>
                    <Tree
                      className="grid gap-0 max-h-52 overflow-auto rounded-sm border border-solid border-[--hl-sm]"
                      defaultSelectedKeys={[gitRepoTreeFetcher.data.id]}
                      disallowEmptySelection
                      defaultExpandedKeys={[gitRepoTreeFetcher.data.id]}
                      onSelectionChange={selection => {
                        if (selection !== 'all') {
                          setWorkspaceData({ ...workspaceData, folderPath: selection.values().next().value });
                        }
                      }}
                      aria-label="Files"
                      selectionMode="single"
                      items={[gitRepoTreeFetcher.data]}
                    >
                      {function renderItem(item) {
                        return (
                          <TreeItem
                            className="group flex odd:bg-[--hl-xxs] flex-col pl-[--tree-item-level] aria-selected:bg-[--hl-lg] aria-disabled:text-[--hl] outline-none border border-solid border-transparent aria-selected:border-[--color-surprise] rounded-sm px-2 py-1 transition-colors duration-300"
                            style={{
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
                            {'children' in item && item.children && (
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
              </div>
              <div className="flex justify-end gap-2 items-center px-10 pb-10">
                <div className='flex items-center gap-2'>
                  <Button
                    onPress={close}
                    className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    onPress={() => createNewWorkspace()}
                    className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
