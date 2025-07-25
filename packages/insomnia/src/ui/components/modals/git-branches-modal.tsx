import React, { type FC, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';
import { useParams, useRevalidator } from 'react-router';

import { useGitProjectCheckoutBranchActionFetcher } from '~/routes/git.branch.checkout';
import { useGitProjectDeleteBranchActionFetcher } from '~/routes/git.branch.delete';
import { useGitProjectNewBranchActionFetcher } from '~/routes/git.branch.new';
import { useGitProjectBranchesLoaderFetcher } from '~/routes/git.branches';
import { useGitProjectChangesFetcher } from '~/routes/git.changes';

import type { MergeConflict } from '../../../sync/types';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { showModal } from '.';
import { AlertModal } from './alert-modal';
import { SyncMergeModal } from './sync-merge-modal';

const LocalBranchItem = ({
  branch,
  isCurrent,
  projectId,
  workspaceId,
  hasUncommittedChanges,
}: {
  branch: string;
  isCurrent: boolean;
  projectId: string;
  workspaceId: string;
  hasUncommittedChanges: boolean;
}) => {
  const checkoutBranchFetcher = useGitProjectCheckoutBranchActionFetcher();
  const deleteBranchFetcher = useGitProjectDeleteBranchActionFetcher();

  useEffect(() => {
    if (
      checkoutBranchFetcher.data &&
      'errors' in checkoutBranchFetcher.data &&
      checkoutBranchFetcher.data.errors &&
      checkoutBranchFetcher.state === 'idle'
    ) {
      const error: string =
        checkoutBranchFetcher.data.errors[0] || 'An unexpected error occurred while checking out the branch.';
      showModal(AlertModal, {
        title: 'Error while checking out branch.',
        message: error,
      });
    }
  }, [checkoutBranchFetcher.data, checkoutBranchFetcher.state]);

  useEffect(() => {
    if (
      deleteBranchFetcher.data &&
      'errors' in deleteBranchFetcher.data &&
      deleteBranchFetcher.data.errors &&
      deleteBranchFetcher.state === 'idle'
    ) {
      const error: string =
        deleteBranchFetcher.data.errors[0] || 'An unexpected error occurred while deleting the branch.';
      showModal(AlertModal, {
        title: 'Error while deleting branch',
        message: error,
      });
    }
  }, [deleteBranchFetcher.data, deleteBranchFetcher.state]);

  const [errMsg, setErrorMessage] = useState('');

  const { revalidate } = useRevalidator();

  return (
    <div className="flex flex-col justify-start">
      <div className="flex w-full items-center">
        <span className="flex-1 truncate">
          {branch} {isCurrent ? '*' : ''}
        </span>
        <div className="flex items-center gap-2">
          {branch !== 'master' && (
            <PromptButton
              confirmMessage="Confirm"
              className="flex min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              doneMessage="Deleted"
              disabled={isCurrent || branch === 'master'}
              onClick={() => {
                setErrorMessage('');
                deleteBranchFetcher.submit({
                  projectId,
                  workspaceId,
                  branch,
                });
              }}
            >
              <Icon
                icon={deleteBranchFetcher.state !== 'idle' ? 'spinner' : 'trash'}
                className={`w-5 text-[--color-danger] ${deleteBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`}
              />
              Delete
            </PromptButton>
          )}
          <Button
            className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
            isDisabled={isCurrent}
            onPress={() => {
              setErrorMessage('');

              checkoutBranchFetcher.submit({
                projectId,
                workspaceId,
                branch,
              });
            }}
          >
            <Icon
              icon={checkoutBranchFetcher.state !== 'idle' ? 'spinner' : 'turn-up'}
              className={`w-5 ${checkoutBranchFetcher.state !== 'idle' ? 'animate-spin' : 'rotate-90'}`}
            />
            Checkout
          </Button>
          <PromptButton
            className="flex min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
            doneMessage="Merged"
            confirmMessage="Confirm"
            loadingMessage="Merging"
            disabled={isCurrent}
            referToOnClickReturnValue
            onClick={async () => {
              setErrorMessage('');

              if (hasUncommittedChanges) {
                setErrorMessage(
                  'You have uncommitted changes in your working tree. Please commit or discard them before merging.',
                );
              }
              try {
                const result = await window.main.git.mergeGitBranch({
                  projectId,
                  workspaceId,
                  theirsBranch: branch,
                  allowUncommittedChangesBeforeMerge: true,
                });

                if ('conflicts' in result) {
                  await new Promise((resolve, reject) => {
                    showModal(SyncMergeModal, {
                      conflicts: result.conflicts,
                      labels: result.labels,
                      handleDone: (conflicts?: MergeConflict[]) => {
                        if (Array.isArray(conflicts) && conflicts.length > 0) {
                          window.main.git
                            .continueMerge({
                              projectId,
                              workspaceId,
                              handledMergeConflicts: conflicts,
                              commitMessage: result.commitMessage,
                              commitParent: result.commitParent,
                            })
                            .then(resolve, reject)
                            .finally(() => {
                              window.main.git.canPushLoader({ projectId, workspaceId });
                              revalidate();
                            });
                        } else {
                          // user aborted merge
                          reject(new Error('You aborted the merge, no changes were made to working tree.'));
                        }
                      },
                    });
                  });
                }

                if ('errors' in result && result.errors && result.errors?.length > 0) {
                  setErrorMessage(result.errors.join('\n'));
                }

                revalidate();
              } catch (err) {
                const errorMessage =
                  err instanceof Error ? err.message : 'An unexpected error occurred while merging the branches.';

                setErrorMessage(errorMessage);
              }
            }}
          >
            <Icon icon={'code-merge'} className={`w-5`} />
            Merge
          </PromptButton>
        </div>
      </div>
      {errMsg && <div className="whitespace-break-spaces text-right text-[--color-danger]">{errMsg}</div>}
    </div>
  );
};

const RemoteBranchItem = ({
  branch,
  projectId,
  workspaceId,
}: {
  branch: string;
  projectId: string;
  workspaceId: string;
}) => {
  const checkoutBranchFetcher = useGitProjectCheckoutBranchActionFetcher();

  useEffect(() => {
    if (
      checkoutBranchFetcher.data &&
      'errors' in checkoutBranchFetcher.data &&
      checkoutBranchFetcher.data.errors &&
      checkoutBranchFetcher.state === 'idle'
    ) {
      const error: string =
        checkoutBranchFetcher.data.errors[0] || 'An unexpected error occurred while pulling the branch.';
      showModal(AlertModal, {
        title: 'Error while pulling branch.',
        message: error,
      });
    }
  }, [checkoutBranchFetcher.data, checkoutBranchFetcher.state]);

  return (
    <div className="flex w-full items-center">
      <span className="flex-1 truncate">{branch}</span>
      <div className="flex items-center gap-2">
        <Button
          className="flex min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          onPress={() =>
            checkoutBranchFetcher.submit({
              projectId,
              workspaceId,
              branch,
            })
          }
        >
          <Icon
            icon={checkoutBranchFetcher.state !== 'idle' ? 'spinner' : 'cloud-arrow-down'}
            className={`w-5 ${checkoutBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`}
          />
          Fetch and checkout
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
  }
  return branchA.localeCompare(branchB);
}

export const GitBranchesModal: FC<Props> = ({ currentBranch, branches, onClose }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const branchesFetcher = useGitProjectBranchesLoaderFetcher();
  const createBranchFetcher = useGitProjectNewBranchActionFetcher();

  const errors = branchesFetcher.data && 'errors' in branchesFetcher.data ? branchesFetcher.data.errors : [];
  const { remoteBranches, branches: localBranches } =
    branchesFetcher.data && 'branches' in branchesFetcher.data
      ? branchesFetcher.data
      : { branches: [], remoteBranches: [] };

  const fetchedBranches = localBranches.length > 0 ? localBranches : branches;
  const remoteOnlyBranches = remoteBranches.filter(b => !fetchedBranches.includes(b));
  const isFetchingRemoteBranches = branchesFetcher.state !== 'idle';

  useEffect(() => {
    if (branchesFetcher.state === 'idle' && !branchesFetcher.data) {
      branchesFetcher.load({
        projectId,
        workspaceId,
      });
    }
  }, [branchesFetcher, organizationId, projectId, workspaceId]);

  const createNewBranchError =
    createBranchFetcher.data?.errors && createBranchFetcher.data.errors.length > 0
      ? createBranchFetcher.data.errors[0]
      : null;

  const gitChangesFetcher = useGitProjectChangesFetcher();
  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      gitChangesFetcher.load({
        projectId,
        workspaceId,
      });
    }
  }, [organizationId, projectId, workspaceId, gitChangesFetcher]);

  const hasUncommittedChanges = Boolean(
    gitChangesFetcher.data?.changes &&
      (gitChangesFetcher.data.changes.staged.length > 0 || gitChangesFetcher.data.changes.unstaged.length > 0),
  );

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex max-h-full w-full max-w-4xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Branches
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault();

                  const formData = new FormData(e.currentTarget);
                  const branch = formData.get('branch')?.toString().trim() || '';
                  createBranchFetcher.submit({
                    branch,
                    projectId,
                    workspaceId,
                  });
                }}
                method="POST"
                className="flex flex-shrink-0 flex-col gap-2"
              >
                <TextField className="flex flex-col gap-2">
                  <Label className="col-span-4">New branch name:</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      required
                      className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
                      type="text"
                      name="branch"
                      placeholder="Branch name"
                    />
                    <Button
                      className="flex h-8 min-w-[12ch] items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      isDisabled={createBranchFetcher.state !== 'idle'}
                      type="submit"
                    >
                      <Icon
                        className={`w-5 ${createBranchFetcher.state !== 'idle' ? 'animate-spin' : ''}`}
                        icon={createBranchFetcher.state !== 'idle' ? 'spinner' : 'plus'}
                      />{' '}
                      Create
                    </Button>
                  </div>
                </TextField>
                {createNewBranchError && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-solid border-[--hl-md] bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] bg-opacity-50 p-[--padding-sm] text-[--color-font-warning]">
                    <p className="text-base">
                      <Icon icon="exclamation-triangle" className="mr-2" />
                      {createNewBranchError}
                    </p>
                  </div>
                )}
              </form>

              <div className="flex max-h-96 flex-1 select-none flex-col divide-y divide-solid divide-[--hl-sm] overflow-hidden rounded border border-solid border-[--hl-sm]">
                <Heading className="p-2 text-sm font-semibold uppercase text-[--hl]">Local Branches</Heading>
                <GridList
                  aria-label="Branches list"
                  selectionMode="none"
                  items={fetchedBranches.sort(sortBranches).map(branch => ({
                    id: branch,
                    key: branch,
                    name: branch,
                    isCurrent: branch === currentBranch,
                  }))}
                  className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-sm] overflow-y-auto focus:outline-none data-[empty]:py-0"
                >
                  {item => (
                    <GridListItem
                      id={item.id}
                      key={item.key}
                      textValue={item.name}
                      className="w-full p-2 transition-colors focus:bg-[--hl-sm] focus:outline-none"
                    >
                      <LocalBranchItem
                        branch={item.name}
                        isCurrent={item.isCurrent}
                        projectId={projectId}
                        workspaceId={workspaceId}
                        hasUncommittedChanges={hasUncommittedChanges}
                      />
                    </GridListItem>
                  )}
                </GridList>
              </div>

              <div className="flex max-h-96 flex-1 select-none flex-col divide-y divide-solid divide-[--hl-sm] overflow-hidden rounded border border-solid border-[--hl-sm]">
                <Heading className="p-2 text-sm font-semibold uppercase text-[--hl]">Remote Branches</Heading>
                <GridList
                  aria-label="Remote Branches list"
                  selectionMode="none"
                  items={remoteOnlyBranches.sort(sortBranches).map(branch => ({
                    id: branch,
                    key: branch,
                    name: branch,
                    isCurrent: branch === currentBranch,
                  }))}
                  renderEmptyState={() => (
                    <div className="p-2 text-center text-[--color-font-disabled]">
                      {isFetchingRemoteBranches ? 'Fetching remote branches...' : 'No remote branches found'}
                    </div>
                  )}
                  className="flex flex-1 flex-col divide-y divide-solid divide-[--hl-sm] overflow-y-auto focus:outline-none data-[empty]:py-0"
                >
                  {item => (
                    <GridListItem
                      id={item.id}
                      key={item.key}
                      textValue={item.name}
                      className="w-full p-2 transition-colors focus:bg-[--hl-sm] focus:outline-none"
                    >
                      <RemoteBranchItem branch={item.name} projectId={projectId} workspaceId={workspaceId} />
                    </GridListItem>
                  )}
                </GridList>
                {errors.length > 0 && (
                  <div className="p-2">
                    {errors.map(error => (
                      <div key={error} className="p-2">
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
};
