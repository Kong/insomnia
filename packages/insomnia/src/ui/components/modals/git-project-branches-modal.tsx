import React, { type FC, useEffect, useState } from 'react';
import { Button, Dialog, GridList, GridListItem, Heading, Input, Label, Modal, ModalOverlay, TextField } from 'react-aria-components';
import { useFetcher, useParams, useRevalidator } from 'react-router-dom';

import { MergeConflictError } from '../../../sync/git/git-vcs';
import type { MergeConflict } from '../../../sync/types';
import { checkGitCanPush, continueMerge, type CreateNewGitBranchResult, type GitBranchesLoaderData, type GitChangesLoaderData, mergeGitBranch } from '../../routes/git-project-actions';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { showAlert, showModal } from '.';
import { SyncMergeModal } from './sync-merge-modal';

const LocalBranchItem = ({
  branch,
  isCurrent,
  organizationId,
  projectId,
  workspaceId,
  hasUncommittedChanges,
}: {
  branch: string;
  isCurrent: boolean;
  organizationId: string;
  projectId: string;
  workspaceId: string;
  hasUncommittedChanges: boolean;
}) => {
  const checkoutBranchFetcher = useFetcher<{} | { error: string }>();
  const mergeBranchFetcher = useFetcher();
  const deleteBranchFetcher = useFetcher();

  useEffect(() => {
    if (checkoutBranchFetcher.data && 'error' in checkoutBranchFetcher.data && checkoutBranchFetcher.data.error && checkoutBranchFetcher.state === 'idle') {
      const error: string = checkoutBranchFetcher.data.error || 'An unexpected error occurred while checking out the branch.';
      showAlert({
        title: 'Error while checking out branch.',
        message: error,
      });
    }
  }, [checkoutBranchFetcher.data, checkoutBranchFetcher.state]);

  useEffect(() => {
    if (mergeBranchFetcher.data && 'error' in mergeBranchFetcher.data && mergeBranchFetcher.data.error && mergeBranchFetcher.state === 'idle') {
      const error: string = mergeBranchFetcher.data.error || 'An unexpected error occurred while merging the branches.';
      showAlert({
        title: 'Error while merging branches.',
        message: error,
      });
    }
  }, [mergeBranchFetcher.data, mergeBranchFetcher.state]);

  useEffect(() => {
    if (deleteBranchFetcher.data && 'error' in deleteBranchFetcher.data && deleteBranchFetcher.data.error && deleteBranchFetcher.state === 'idle') {
      const error: string = deleteBranchFetcher.data.error || 'An unexpected error occurred while deleting the branch.';
      showAlert({
        title: 'Error while deleting branch',
        message: error,
      });
    }
  }, [deleteBranchFetcher.data, deleteBranchFetcher.state]);

  const [errMsg, setErrMsg] = useState('');

  const { revalidate } = useRevalidator();

  return (
    <div className='flex flex-col justify-start'>
      <div className="flex items-center w-full">
        <span className='flex-1 truncate'>{branch} {isCurrent ? '*' : ''}</span>
        <div className='flex items-center gap-2'>
          {branch !== 'master' && (
            <PromptButton
              confirmMessage='Confirm'
              className="px-4 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              doneMessage="Deleted"
              disabled={isCurrent || branch === 'master'}
              onClick={() => {
                setErrMsg('');
                deleteBranchFetcher.submit(
                  {
                    branch,
                  },
                  {
                    method: 'POST',
                    action: `/organization/${organizationId}/project/${projectId}/git/branch/delete`,
                  },
                );
              }}
            >
              <Icon icon={deleteBranchFetcher.state !== 'idle' ? 'spinner' : 'trash'} className={`text-[--color-danger] w-5 ${deleteBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
              Delete
            </PromptButton>
          )}
          <Button
            className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            isDisabled={isCurrent}
            onPress={() => {
              setErrMsg('');
              // file://./../../routes/git-actions.tsx#checkoutGitBranchAction
              checkoutBranchFetcher.submit({
                branch,
              }, {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/git/branch/checkout`,
              });
            }}
          >
            <Icon icon={checkoutBranchFetcher.state !== 'idle' ? 'spinner' : 'turn-up'} className={`w-5 ${checkoutBranchFetcher.state !== 'idle' ? 'animate-spin' : 'rotate-90'}`} />
            Checkout
          </Button>
          <PromptButton
            className="px-4 py-1 min-w-[12ch] font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            doneMessage="Merged"
            confirmMessage='Confirm'
            loadingMessage='Merging'
            disabled={isCurrent}
            referToOnClickReturnValue
            onClick={async () => {
              setErrMsg('');
              try {
                if (hasUncommittedChanges) {
                  throw new Error('There are uncommitted changes on current branch. Please commit them first.');
                }
                try {
                  await mergeGitBranch({
                    projectId,
                    theirsBranch: branch,
                    allowUncommittedChangesBeforeMerge: true,
                  });
                  checkGitCanPush(workspaceId);
                  revalidate();
                } catch (err) {
                  if (err instanceof MergeConflictError) {
                    const data = err.data;
                    await new Promise((resolve, reject) => {
                      showModal(SyncMergeModal, {
                        conflicts: data.conflicts,
                        labels: data.labels,
                        handleDone: (conflicts?: MergeConflict[]) => {
                          if (Array.isArray(conflicts) && conflicts.length > 0) {
                            continueMerge({
                              projectId,
                              handledMergeConflicts: conflicts,
                              commitMessage: data.commitMessage,
                              commitParent: data.commitParent,
                            }).then(
                              resolve,
                              reject,
                            ).finally(() => {
                              checkGitCanPush(workspaceId);
                              revalidate();
                            });
                          } else {
                            // user aborted merge
                            reject(new Error('You aborted the merge, no changes were made to working tree.'));
                          }
                        },
                      });
                    });
                  } else {
                    throw new Error(`Merge failed: ${err.message}`);
                  }
                }
              } catch (err) {
                setErrMsg(err.message);
                throw err;
              }
            }}
          >
            <Icon icon={mergeBranchFetcher.state !== 'idle' ? 'spinner' : 'code-merge'} className={`w-5 ${mergeBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} />
            Merge
          </PromptButton>
        </div>
      </div>
      {errMsg && (
        <div className='text-right text-[--color-danger] whitespace-break-spaces'>
          {errMsg}
        </div>
      )}
    </div>
  );
};

const RemoteBranchItem = ({
  branch,
  organizationId,
  projectId,
}: {
  branch: string;
  isCurrent: boolean;
  organizationId: string;
  projectId: string;
  workspaceId: string;
}) => {
  const pullBranchFetcher = useFetcher();

  useEffect(() => {
    if (pullBranchFetcher.data && 'error' in pullBranchFetcher.data && pullBranchFetcher.data.error && pullBranchFetcher.state === 'idle') {
      const error: string = pullBranchFetcher.data.error || 'An unexpected error occurred while pulling the branch.';
      showAlert({
        title: 'Error while pulling branch.',
        message: error,
      });
    }
  }, [pullBranchFetcher.data, pullBranchFetcher.state]);

  return (
    <div className="flex items-center w-full">
      <span className='flex-1 truncate'>{branch}</span>
      <div className='flex items-center gap-2'>
        <Button
          className="px-4 py-1 min-w-[12ch] font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
          onPress={() => pullBranchFetcher.submit({
            branch,
          }, {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/git/branch/checkout`,
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
  currentBranch: string;
  branches: string[];
  onClose: () => void;
}

function sortBranches(branchA: string, branchB: string) {
  if (branchA === 'master') {
    return -1;
  } else if (branchB === 'master') {
    return 1;
  } else {
    return branchA.localeCompare(branchB);
  }
}

export const GitProjectBranchesModal: FC<Props> = (({
  currentBranch,
  branches,
  onClose,
}) => {
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const branchesFetcher = useFetcher<GitBranchesLoaderData>();
  const createBranchFetcher = useFetcher<CreateNewGitBranchResult>();

  const errors = branchesFetcher.data && 'errors' in branchesFetcher.data ? branchesFetcher.data.errors : [];
  const { remoteBranches, branches: localBranches } = branchesFetcher.data && 'branches' in branchesFetcher.data ? branchesFetcher.data : { branches: [], remoteBranches: [] };

  const fetchedBranches = localBranches.length > 0 ? localBranches : branches;
  const remoteOnlyBranches = remoteBranches.filter(b => !fetchedBranches.includes(b));
  const isFetchingRemoteBranches = branchesFetcher.state !== 'idle';

  useEffect(() => {
    if (branchesFetcher.state === 'idle' && !branchesFetcher.data) {
      branchesFetcher.load(`/organization/${organizationId}/project/${projectId}/git/branches`);
    }
  }, [branchesFetcher, organizationId, projectId, workspaceId]);

  const createNewBranchError = createBranchFetcher.data?.errors && createBranchFetcher.data.errors.length > 0 ? createBranchFetcher.data.errors[0] : null;

  const gitChangesFetcher = useFetcher<GitChangesLoaderData>();
  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      // file://./../../routes/git-actions.tsx#gitChangesLoader
      gitChangesFetcher.load(`/organization/${organizationId}/project/${projectId}/git/changes`);
    }
  }, [organizationId, projectId, workspaceId, gitChangesFetcher]);

  const hasUncommittedChanges = Boolean(
    gitChangesFetcher.data?.changes && (
      gitChangesFetcher.data.changes.staged.length > 0 ||
      gitChangesFetcher.data.changes.unstaged.length > 0
    )
  );

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex-shrink-0 flex gap-2 items-center justify-between'>
                <Heading slot='title' className='text-2xl'>Branches</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <createBranchFetcher.Form
                action={`/organization/${organizationId}/project/${projectId}/git/branch/new`}
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
                      name="branch"
                      placeholder="Branch name"
                    />
                    <Button className="px-4 h-8 min-w-[12ch] py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm" isDisabled={createBranchFetcher.state !== 'idle'} type="submit">
                      <Icon className={`w-5 ${createBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`} icon={createBranchFetcher.state !== 'idle' ? 'spinner' : 'plus'} /> Create
                    </Button>
                  </div>
                </TextField>
                {createNewBranchError && (
                  <div className='flex flex-wrap justify-between items-center gap-2 p-[--padding-sm] border border-solid border-[--hl-md] bg-opacity-50 bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] text-[--color-font-warning] rounded'>
                    <p className='text-base'>
                      <Icon icon="exclamation-triangle" className='mr-2' />
                      {createNewBranchError}
                    </p>
                  </div>
                )}
              </createBranchFetcher.Form>

              <div className='flex-1 max-h-96 overflow-hidden flex flex-col select-none border border-solid rounded border-[--hl-sm] divide-y divide-solid divide-[--hl-sm]'>
                <Heading className='font-semibold uppercase text-[--hl] text-sm p-2'>Local Branches</Heading>
                <GridList
                  aria-label='Branches list'
                  selectionMode='none'
                  items={fetchedBranches.sort(sortBranches).map(branch => ({
                    id: branch,
                    key: branch,
                    name: branch,
                    isCurrent: branch === currentBranch,
                  }))}
                  className="divide-y divide-solid divide-[--hl-sm] flex flex-col focus:outline-none overflow-y-auto flex-1 data-[empty]:py-0"
                >
                  {item => (
                    <GridListItem
                      id={item.id}
                      key={item.key}
                      textValue={item.name}
                      className="p-2 w-full focus:outline-none focus:bg-[--hl-sm] transition-colors"
                    >
                      <LocalBranchItem
                        branch={item.name}
                        isCurrent={item.isCurrent}
                        organizationId={organizationId}
                        projectId={projectId}
                        workspaceId={workspaceId}
                        hasUncommittedChanges={hasUncommittedChanges}
                      />
                    </GridListItem>
                  )}
                </GridList>
              </div>

              <div className='flex-1 max-h-96 overflow-hidden flex flex-col select-none border border-solid rounded border-[--hl-sm] divide-y divide-solid divide-[--hl-sm]'>
                <Heading className='font-semibold uppercase text-[--hl] text-sm p-2'>Remote Branches</Heading>
                <GridList
                  aria-label='Remote Branches list'
                  selectionMode='none'
                  items={remoteOnlyBranches.sort(sortBranches).map(branch => ({
                    id: branch,
                    key: branch,
                    name: branch,
                    isCurrent: branch === currentBranch,
                  }))}
                  renderEmptyState={() => (
                    <div className='p-2 text-[--color-font-disabled] text-center'>
                      {isFetchingRemoteBranches ? 'Fetching remote branches...' : 'No remote branches found'}
                    </div>
                  )}
                  className="divide-y divide-solid divide-[--hl-sm] flex flex-col focus:outline-none overflow-y-auto flex-1 data-[empty]:py-0"
                >
                  {item => (
                    <GridListItem
                      id={item.id}
                      key={item.key}
                      textValue={item.name}
                      className="p-2 w-full focus:outline-none focus:bg-[--hl-sm] transition-colors"
                    >
                      <RemoteBranchItem branch={item.name} isCurrent={item.isCurrent} organizationId={organizationId} projectId={projectId} workspaceId={workspaceId} />
                    </GridListItem>
                  )}
                </GridList>
                {errors.length > 0 && (
                  <div className='p-2'>
                    {errors.map(error => (
                      <div key={error} className='p-2'>
                        {error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});
