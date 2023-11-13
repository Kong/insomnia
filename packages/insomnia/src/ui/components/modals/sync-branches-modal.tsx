import React from 'react';
import { Button, Dialog, GridList, Heading, Input, Item, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';

const LocalBranchItem = ({
  branch,
  isCurrent,
  organizationId,
  projectId,
  workspaceId,
}: {
  branch: string;
  isCurrent: boolean;
  organizationId: string;
  projectId: string;
  workspaceId: string;
}) => {
  const checkoutBranchFetcher = useFetcher();
  const mergeBranchFetcher = useFetcher();
  const deleteBranchFetcher = useFetcher();
  return (
    <div className="flex items-center w-full">
      <span className='flex-1'>{branch}</span>
      <div className='flex items-center gap-2'>
        {branch !== 'master' && (
          <PromptButton
            confirmMessage='Confirm'
            className="px-4 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            doneMessage="Deleted"
            disabled={isCurrent || branch === 'master'}
            onClick={() => deleteBranchFetcher.submit(
              {
                branch,
              },
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/delete`,
              },
            )}
          >
            <Icon icon={deleteBranchFetcher.state !== 'idle' ? 'spinner' : 'trash'} className={`text-[--color-danger] w-5 ${deleteBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
            Delete
          </PromptButton>
        )}
        <Button
          className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          isDisabled={isCurrent}
          onPress={() => checkoutBranchFetcher.submit({
            branch,
          }, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/checkout`,
          })}
        >
          <Icon icon={checkoutBranchFetcher.state !== 'idle' ? 'spinner' : 'turn-up'} className={`w-5 ${checkoutBranchFetcher.state !== 'idle' ? 'animate-spin' : 'rotate-90'}`} />
          Checkout
        </Button>
        <PromptButton
          className="px-4 py-1 min-w-[12ch] font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          doneMessage="Merged"
          confirmMessage='Confirm'
          disabled={isCurrent}
          onClick={() => mergeBranchFetcher.submit({
            branch,
          }, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/merge`,
          })}
        >
          <Icon icon={mergeBranchFetcher.state !== 'idle' ? 'spinner' : 'code-merge'} className={`w-5 ${mergeBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
          Merge
        </PromptButton>
      </div>
    </div>
  );
};

const RemoteBranchItem = ({
  branch,
  isCurrent,
  organizationId,
  projectId,
  workspaceId,
}: {
  branch: string;
  isCurrent: boolean;
  organizationId: string;
  projectId: string;
  workspaceId: string;
}) => {
  const deleteBranchFetcher = useFetcher();
  const pullBranchFetcher = useFetcher();

  return (
    <div className="flex items-center w-full">
      <span className='flex-1'>{branch}</span>
      <div className='flex items-center gap-2'>
        {branch !== 'master' && (
          <PromptButton
            confirmMessage='Confirm'
            className="px-4 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            doneMessage="Deleted"
            disabled={isCurrent || branch === 'master'}
            onClick={() => deleteBranchFetcher.submit(
              {
                branch,
              },
              {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/delete`,
              },
            )}
          >
            <Icon icon={deleteBranchFetcher.state !== 'idle' ? 'spinner' : 'trash'} className={`text-[--color-danger] w-5 ${deleteBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
            Delete
          </PromptButton>
        )}
        <Button
          className="px-4 py-1 min-w-[12ch] font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() => pullBranchFetcher.submit({
            branch,
          }, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/fetch`,
          })}
        >
          <Icon icon={pullBranchFetcher.state !== 'idle' ? 'spinner' : 'cloud-arrow-down'} className={`w-5 ${pullBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
          Fetch
        </Button>
      </div>
    </div>
  );
};
interface Props {
  branches: string[];
  remoteBranches: string[];
  currentBranch: string;
  onClose: () => void;
}

export const SyncBranchesModal = ({ onClose, branches, remoteBranches, currentBranch }: Props) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const createBranchFetcher = useFetcher();

  function sortBranches(branchA: string, branchB: string) {
    if (branchA === 'master') {
      return -1;
    } else if (branchB === 'master') {
      return 1;
    } else {
      return branchA.localeCompare(branchB);
    }
  }

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
        <Dialog
          onClose={onClose}
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex-shrink-0 flex gap-2 items-center justify-between'>
                <Heading className='text-2xl'>Branches</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <createBranchFetcher.Form
                action={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create`}
                method='POST'
                className='flex flex-col gap-2 flex-shrink-0'
              >
                <TextField className="flex flex-col gap-2">
                  <Label className='col-span-4'>
                    New branch name:
                  </Label>
                  <div className='flex items-center gap-2'>
                    <Input
                      required
                      className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
                      type="text"
                      name="branchName"
                      placeholder="Branch name"
                    />
                    <Button className="px-4 h-8 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm" isDisabled={createBranchFetcher.state !== 'idle'} type="submit">
                      <Icon className={`w-5 ${createBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} icon={createBranchFetcher.state !== 'idle' ? 'spinner' : 'plus'} /> Create
                    </Button>
                  </div>
                </TextField>
              </createBranchFetcher.Form>

              {createBranchFetcher.data?.error && (
                <div className='flex items-center gap-2 flex-shrink-0'>
                  <Icon icon='triangle-exclamation' className='w-5 text-[--color-danger]' />
                  <span className='text-[--color-danger] text-sm'>{createBranchFetcher.data.error}</span>
                </div>
              )}

              <div className='flex-1 max-h-96 overflow-hidden flex flex-col select-none border border-solid rounded border-[--hl-sm] divide-y divide-solid divide-[--hl-sm]'>
                <Heading className='font-semibold uppercase text-[--hl] text-sm p-2'>Local Branches</Heading>
                <GridList
                  aria-label='Branches list'
                  selectionMode='none'
                  items={branches.sort(sortBranches).map(branch => ({
                    id: branch,
                    key: branch,
                    name: branch,
                    isCurrent: branch === currentBranch,
                  }))}
                  className="divide-y divide-solid divide-[--hl-sm] flex flex-col focus:outline-none overflow-y-auto flex-1 data-[empty]:py-0"
                >
                  {item => (
                    <Item
                      id={item.id}
                      key={item.key}
                      textValue={item.name}
                      className="p-2 w-full focus:outline-none focus:bg-[--hl-sm] transition-colors"
                    >
                      <LocalBranchItem branch={item.name} isCurrent={item.isCurrent} organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
                    </Item>
                  )}
                </GridList>
              </div>

              {remoteBranches.length > 0 && (
                <div className='select-none border border-solid rounded border-[--hl-sm] divide-y divide-solid divide-[--hl-sm]'>
                  <Heading className='font-semibold uppercase text-[--hl] text-sm p-2'>Remote Branches</Heading>
                  <GridList
                    aria-label='Remote Branches list'
                    selectionMode='none'
                    items={remoteBranches.sort(sortBranches).map(branch => ({
                      id: branch,
                      key: branch,
                      name: branch,
                      isCurrent: branch === currentBranch,
                    }))}
                    className="divide-y divide-solid divide-[--hl-sm] flex flex-col focus:outline-none overflow-y-auto flex-1 data-[empty]:py-0"
                  >
                    {item => (
                      <Item
                        id={item.id}
                        key={item.key}
                        textValue={item.name}
                        className="p-2 w-full focus:outline-none focus:bg-[--hl-sm] transition-colors"
                      >
                        <RemoteBranchItem branch={item.name} isCurrent={item.isCurrent} organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
                      </Item>
                    )}
                  </GridList>
                </div>
              )}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
