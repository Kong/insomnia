import React, { type FC, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Label,
  Modal,
  ModalOverlay,
  TextArea,
  TextField,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { useGitProjectChangesFetcher } from '~/routes/git.changes';
import { useGitProjectCommitActionFetcher } from '~/routes/git.commit';
import { useGitProjectDiffLoaderFetcher } from '~/routes/git.diff';
import { useGitProjectDiscardActionFetcher } from '~/routes/git.discard';
import { useGitProjectStageActionFetcher } from '~/routes/git.stage';
import { useGitProjectUnstageActionFetcher } from '~/routes/git.unstage';

import { GitFileType, GitVCSOperationErrors } from '../../../sync/git/git-vcs';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';
import { GitPullRequiredModal } from './git-pull-required-modal';

export type StagingModalMode = 'default' | 'commit-and-pull';

export const StagingModalModes = {
  default: 'default' as StagingModalMode,
  commitAndPull: 'commit-and-pull' as StagingModalMode,
};

interface DiscardData {
  paths: string[];
  filesCount: number;
}

function getModificationClassName(type: string) {
  switch (type) {
    case GitFileType.Added: {
      return 'text-[#73c991]';
    }
    case GitFileType.Deleted: {
      return 'text-[#f14c4c]';
    }
    case GitFileType.Modified: {
      return 'text-[#e2c08d]';
    }
    case GitFileType.Renamed: {
      return 'text-[#519aba]';
    }
    case GitFileType.Copied: {
      return 'text-[#4ec9b0]';
    }
    case GitFileType.Untracked: {
      return 'text-[#73c991]';
    }
    case GitFileType.Ignored: {
      return 'text-[#8c8c8c]';
    }
    case GitFileType.Conflicted: {
      return 'text-[#d670d6]';
    }
    default: {
      return '';
    }
  }
}

export const GitProjectStagingModal: FC<{
  mode?: StagingModalMode;
  onClose: () => void;
  onPullAfterCommit: () => void;
  onPushAfterPull: () => void;
}> = ({ mode = StagingModalModes.default, onClose, onPullAfterCommit, onPushAfterPull }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [operationError, setOperationError] = useState<string | null>(null);
  const [isGitPullRequiredModalOpen, setIsGitPullRequiredModalOpen] = useState(false);
  const [showConfirmDiscardAndPullModal, setShowConfirmDiscardAndPullModal] = React.useState(false);
  const [discardData, setDiscardData] = React.useState<DiscardData | null>(null);

  const gitChangesFetcher = useGitProjectChangesFetcher();

  const stageChangesFetcher = useGitProjectStageActionFetcher();
  const unstageChangesFetcher = useGitProjectUnstageActionFetcher();
  const undoUnstagedChangesFetcher = useGitProjectDiscardActionFetcher();
  const diffChangesFetcher = useGitProjectDiffLoaderFetcher();
  const commitFetcher = useGitProjectCommitActionFetcher();

  const [message, setMessage] = useState('');
  // Add this state at the top of your component
  const [committingAction, setCommittingAction] = useState<'commit' | 'commit-push' | null>(null);

  function diffChanges({ path, staged }: { path: string; staged: boolean }) {
    diffChangesFetcher.load({
      projectId,
      filePath: path,
      staged,
    });
  }

  function stageChanges(paths: string[]) {
    stageChangesFetcher.submit({
      projectId,
      paths,
    });
  }

  function unstageChanges(paths: string[]) {
    unstageChangesFetcher.submit({
      projectId,
      paths,
    });
  }

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      gitChangesFetcher.load({
        projectId,
      });
    }
  }, [organizationId, projectId, workspaceId, gitChangesFetcher]);

  const { changes } = gitChangesFetcher.data || {
    changes: {
      staged: [],
      unstaged: [],
    },
    branch: '',
    statusNames: {},
  };

  const isCommitting = commitFetcher.state !== 'idle';

  useEffect(() => {
    if (commitFetcher.data && commitFetcher.data.errors && commitFetcher.data.errors.length > 0) {
      if (commitFetcher.data.errors.includes(GitVCSOperationErrors.RequiredPullRemoteChangesError)) {
        setIsGitPullRequiredModalOpen(true);
      } else {
        setOperationError(commitFetcher.data.errors.join('\n'));
      }
    }
  }, [commitFetcher.data]);

  const previewDiffItem = diffChangesFetcher.data && 'diff' in diffChangesFetcher.data ? diffChangesFetcher.data : null;

  const allChanges = [...changes.staged, ...changes.unstaged];
  const allChangesLength = allChanges.length;
  const hasNoCommitErrors =
    commitFetcher.data && 'errors' in commitFetcher.data && commitFetcher.data.errors?.length === 0;

  useEffect(() => {
    if (allChangesLength === 0 && hasNoCommitErrors) {
      if (mode === StagingModalModes.commitAndPull) {
        onPullAfterCommit();
      }

      onClose();
    }
  }, [allChangesLength, onClose, hasNoCommitErrors, mode, onPullAfterCommit]);

  useEffect(() => {
    if (commitFetcher.data && hasNoCommitErrors) {
      setMessage('');
    }
  }, [commitFetcher.data, hasNoCommitErrors]);

  // These used only when the mode is commitAndPull
  const canCommitAndPull = changes.staged.length > 0 && changes.unstaged.length === 0;

  return (
    <>
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
          className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
        >
          <Dialog
            data-loading={gitChangesFetcher.state === 'loading' ? 'true' : undefined}
            className="flex h-full flex-1 flex-col overflow-hidden outline-none data-[loading]:animate-pulse"
          >
            {({ close }) => (
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex flex-shrink-0 items-center justify-between gap-2">
                  <Heading slot="title" className="flex items-center gap-2 text-2xl">
                    {mode === StagingModalModes.commitAndPull ? 'Uncommitted changes' : 'Commit Changes'}{' '}
                    {gitChangesFetcher.state === 'loading' && <Icon icon="spinner" className="animate-spin" />}
                  </Heading>

                  <Button
                    className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                {mode === StagingModalModes.commitAndPull && (
                  <div className="'text-[--color-font-warning] flex flex-wrap items-center justify-between gap-2 rounded border border-solid border-[--hl-md] bg-[rgba(var(--color-warning-rgb),0.5)] p-[--padding-sm]">
                    <p className="text-base">
                      <Icon icon="exclamation-triangle" className="mr-2" />
                      You have uncommitted changes. Commit or discard them to proceed with pull.
                    </p>
                  </div>
                )}
                <div className="grid h-full gap-2 divide-x divide-solid divide-[--hl-md] overflow-hidden [grid-template-columns:300px_1fr]">
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        const submitter = e.nativeEvent instanceof SubmitEvent ? e.nativeEvent.submitter : null;
                        const formData = new FormData(e.currentTarget, submitter);
                        const message = formData.get('message')?.toString() || '';
                        const push = Boolean(formData.get('push') === 'true');

                        setCommittingAction(push ? 'commit-push' : 'commit');

                        commitFetcher.submit({
                          projectId,
                          message,
                          push,
                        });
                      }}
                      className="flex flex-col gap-2"
                    >
                      <TextField className="flex flex-shrink-0 flex-col gap-2">
                        <Label className="font-bold">Message</Label>
                        <TextArea
                          rows={3}
                          name="message"
                          className="resize-none rounded-sm border border-solid border-[--hl-sm] p-2 placeholder:text-[--hl-md]"
                          placeholder="This is a helpful message that describes the changes made in this commit."
                          required
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                        />
                      </TextField>
                      {mode === StagingModalModes.commitAndPull ? (
                        <div className="flex items-center gap-2">
                          <Button
                            type="submit"
                            isDisabled={isCommitting || changes.staged.length === 0}
                            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                          >
                            {canCommitAndPull ? (
                              <>
                                <Icon
                                  icon={isCommitting ? 'spinner' : 'cloud-arrow-down'}
                                  className={`w-5 ${isCommitting ? 'animate-spin' : ''}`}
                                />
                                Commit and pull
                              </>
                            ) : (
                              <>
                                <Icon
                                  icon={isCommitting ? 'spinner' : 'check'}
                                  className={`w-5 ${isCommitting ? 'animate-spin' : ''}`}
                                />
                                Commit
                              </>
                            )}
                          </Button>
                          <Button
                            type="button"
                            isDisabled={isCommitting}
                            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                            onPress={() => {
                              setShowConfirmDiscardAndPullModal(true);
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="size-4"
                            >
                              <path d="M5.828 7l2.536 2.535L6.95 10.95 2 6l4.95-4.95 1.414 1.415L5.828 5H13a8 8 0 110 16H4v-2h9a6 6 0 000-12H5.828z" />
                            </svg>
                            Discard and pull
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-shrink-0 items-center justify-stretch gap-2">
                          <Button
                            type="submit"
                            isDisabled={(committingAction === 'commit' && isCommitting) || changes.staged.length === 0}
                            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                          >
                            <Icon
                              icon={committingAction === 'commit' && isCommitting ? 'spinner' : 'check'}
                              className={`w-5 ${committingAction === 'commit' && isCommitting ? 'animate-spin' : ''}`}
                            />{' '}
                            Commit
                          </Button>

                          <Button
                            type="submit"
                            isDisabled={
                              (committingAction === 'commit-push' && isCommitting) || changes.staged.length === 0
                            }
                            name="push"
                            value="true"
                            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                          >
                            <Icon
                              icon={committingAction === 'commit-push' && isCommitting ? 'spinner' : 'cloud-arrow-up'}
                              className={`w-5 ${committingAction === 'commit-push' && isCommitting ? 'animate-spin' : ''}`}
                            />{' '}
                            Commit and push
                          </Button>
                        </div>
                      )}
                      {operationError && (
                        <p className="rounded-sm bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))] bg-opacity-20 p-2 text-sm text-[--color-font-danger]">
                          <Icon icon="exclamation-triangle" /> {operationError}
                        </p>
                      )}
                    </form>

                    <div className="grid auto-rows-auto gap-2 overflow-y-auto">
                      <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
                        <Heading className="group flex w-full flex-shrink-0 items-center justify-between gap-2 py-1 font-semibold">
                          <span className="flex-1">Staged changes</span>
                          <TooltipTrigger>
                            <Button
                              className="flex aspect-square h-6 items-center justify-center rounded-sm text-base text-[--color-font] opacity-100 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:text-[rgba(var(--color-font-rgb),0.5)] aria-pressed:bg-[--hl-sm]"
                              slot={null}
                              name="Unstage all changes"
                              isDisabled={changes.staged.length === 0}
                              onPress={() => {
                                unstageChanges(changes.staged.map(entry => entry.path));
                              }}
                            >
                              <Icon icon="minus" aria-hidden pointerEvents="none" />
                            </Button>
                            <Tooltip
                              offset={8}
                              className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                            >
                              Unstage all changes
                            </Tooltip>
                          </TooltipTrigger>
                          <span className="flex size-6 items-center justify-center rounded-full bg-[--hl-sm] px-1 text-sm text-[--hl]">
                            {changes.staged.length}
                          </span>
                        </Heading>
                        <div className="flex w-full flex-1 select-none overflow-y-auto">
                          <GridList
                            className="w-full"
                            aria-label="Unstaged changes"
                            items={changes.staged.map(entry => ({
                              entry,
                              id: entry.path,
                              textValue: entry.path,
                            }))}
                            onAction={key => {
                              diffChanges({
                                path: key.toString(),
                                staged: true,
                              });
                            }}
                            renderEmptyState={() => (
                              <p className="p-2 text-sm text-[--hl]">Stage your changes to commit them.</p>
                            )}
                          >
                            {item => {
                              return (
                                <GridListItem className="group flex w-full select-none items-center justify-between overflow-hidden px-2 py-1 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font]">
                                  <span
                                    className={`truncate ${item.entry.type === GitFileType.Deleted ? 'line-through' : ''}`}
                                  >
                                    {item.entry.path}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <TooltipTrigger>
                                      <Button
                                        className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                        slot={null}
                                        name="Unstage change"
                                        onPress={() => {
                                          unstageChanges([item.entry.path]);
                                        }}
                                      >
                                        <Icon icon="minus" aria-hidden pointerEvents="none" />
                                      </Button>
                                      <Tooltip
                                        offset={8}
                                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                                      >
                                        Unstage change
                                      </Tooltip>
                                    </TooltipTrigger>
                                    <TooltipTrigger>
                                      <Button
                                        className={`cursor-default text-sm ${getModificationClassName(item.entry.type)}`}
                                      >
                                        {item.entry.symbol}
                                      </Button>
                                      <Tooltip
                                        offset={8}
                                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm capitalize text-[--color-font] shadow-lg focus:outline-none"
                                      >
                                        {item.entry.type}
                                      </Tooltip>
                                    </TooltipTrigger>
                                  </div>
                                </GridListItem>
                              );
                            }}
                          </GridList>
                        </div>
                      </div>
                      <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
                        <Heading className="group flex w-full flex-shrink-0 items-center justify-between py-1 font-semibold">
                          <span>Changes</span>
                          <div className="flex items-center gap-2">
                            <TooltipTrigger>
                              <Button
                                className="flex aspect-square h-6 items-center justify-center rounded-sm text-base text-[--color-font] opacity-100 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:text-[rgba(var(--color-font-rgb),0.5)] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                slot={null}
                                name="Discard all changes"
                                isDisabled={changes.unstaged.length === 0}
                                onPress={() => {
                                  setDiscardData({
                                    paths: changes.unstaged.map(entry => entry.path),
                                    filesCount: changes.unstaged.length,
                                  });
                                }}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                  className="size-4"
                                >
                                  <path d="M5.828 7l2.536 2.535L6.95 10.95 2 6l4.95-4.95 1.414 1.415L5.828 5H13a8 8 0 110 16H4v-2h9a6 6 0 000-12H5.828z" />
                                </svg>
                              </Button>
                              <Tooltip
                                offset={8}
                                className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                              >
                                Discard all changes
                              </Tooltip>
                            </TooltipTrigger>
                            <TooltipTrigger>
                              <Button
                                className="flex aspect-square h-6 items-center justify-center gap-2 rounded-sm px-2 text-base text-[--color-font] opacity-100 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:text-[rgba(var(--color-font-rgb),0.5)] aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                slot={null}
                                name="Stage all changes"
                                isDisabled={changes.unstaged.length === 0}
                                onPress={() => {
                                  stageChanges(changes.unstaged.map(entry => entry.path));
                                }}
                              >
                                <Icon icon="plus" aria-hidden pointerEvents="none" />
                              </Button>
                              <Tooltip
                                offset={8}
                                className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                              >
                                Stage all changes
                              </Tooltip>
                            </TooltipTrigger>
                            <span className="flex size-6 items-center justify-center rounded-full bg-[--hl-sm] px-1 text-sm text-[--hl]">
                              {changes.unstaged.length}
                            </span>
                          </div>
                        </Heading>
                        <div className="flex w-full flex-1 select-none overflow-y-auto">
                          <GridList
                            aria-label="Unstaged changes"
                            className="w-full"
                            items={changes.unstaged.map(entry => ({
                              entry,
                              id: entry.path,
                              key: entry.path,
                              textValue: entry.path,
                            }))}
                            onAction={key => {
                              diffChanges({
                                path: key.toString(),
                                staged: false,
                              });
                            }}
                          >
                            {item => {
                              return (
                                <GridListItem className="group flex w-full select-none items-center justify-between overflow-hidden px-2 py-1 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font]">
                                  <span
                                    className={`truncate ${item.entry.type === GitFileType.Deleted ? 'line-through' : ''}`}
                                  >
                                    {item.entry.path}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <TooltipTrigger>
                                      <Button
                                        className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                        slot={null}
                                        name="Discard change"
                                        onPress={() => {
                                          setDiscardData({
                                            paths: [item.entry.path],
                                            filesCount: 1,
                                          });
                                        }}
                                      >
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          viewBox="0 0 24 24"
                                          fill="currentColor"
                                          className="size-4"
                                        >
                                          <path d="M5.828 7l2.536 2.535L6.95 10.95 2 6l4.95-4.95 1.414 1.415L5.828 5H13a8 8 0 110 16H4v-2h9a6 6 0 000-12H5.828z" />
                                        </svg>
                                      </Button>
                                      <Tooltip
                                        offset={8}
                                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                                      >
                                        Discard change
                                      </Tooltip>
                                    </TooltipTrigger>
                                    <TooltipTrigger>
                                      <Button
                                        className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                        slot={null}
                                        name="Stage change"
                                        onPress={() => {
                                          stageChanges([item.entry.path]);
                                        }}
                                      >
                                        <Icon icon="plus" aria-hidden pointerEvents="none" />
                                      </Button>
                                      <Tooltip
                                        offset={8}
                                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                                      >
                                        Stage change
                                      </Tooltip>
                                    </TooltipTrigger>
                                    <TooltipTrigger>
                                      <Button
                                        className={`cursor-default text-sm ${getModificationClassName(item.entry.type)}`}
                                      >
                                        {item.entry.symbol}
                                      </Button>
                                      <Tooltip
                                        offset={8}
                                        className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm capitalize text-[--color-font] shadow-lg focus:outline-none"
                                      >
                                        {item.entry.type}
                                      </Tooltip>
                                    </TooltipTrigger>
                                  </div>
                                </GridListItem>
                              );
                            }}
                          </GridList>
                        </div>
                      </div>
                    </div>
                  </div>
                  {previewDiffItem?.diff ? (
                    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-0">
                      <Heading className="flex items-center gap-2 font-bold">
                        <Icon icon="code-compare" />
                        {previewDiffItem.name}
                      </Heading>
                      {previewDiffItem && (
                        <div className="flex-1 overflow-y-auto rounded-sm bg-[--hl-xs] p-2 text-[--color-font]">
                          <DiffEditor original={previewDiffItem.diff.before} modified={previewDiffItem.diff.after} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-4 p-2">
                      <Heading className="flex items-center justify-center gap-2 text-4xl font-semibold text-[--hl-md]">
                        <Icon icon="code-compare" />
                        Diff view
                      </Heading>
                      <p className="text-[--hl]">Select an item to compare</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
      {showConfirmDiscardAndPullModal && (
        <ConfirmDiscardModal
          message={`Are you sure you want to discard ${changes.unstaged.length + changes.staged.length === 1 ? 'your changes to this file' : `your changes to these ${changes.unstaged.length + changes.staged.length} files`}? This action cannot be undone and will discard any changes since your last commit.`}
          onConfirm={async () => {
            await undoUnstagedChangesFetcher.submit({
              projectId,
              paths: [...changes.unstaged.map(entry => entry.path), ...changes.staged.map(entry => entry.path)],
            });

            setShowConfirmDiscardAndPullModal(false);
            onPullAfterCommit();
          }}
          onClose={() => setShowConfirmDiscardAndPullModal(false)}
        />
      )}
      {discardData && (
        <ConfirmDiscardModal
          message={`Are you sure you want to discard ${discardData.filesCount === 1 ? 'your changes to this file' : `your changes to these ${discardData.filesCount} files`}? This action cannot be undone and will discard any changes since your last commit.`}
          onConfirm={async () => {
            await undoUnstagedChangesFetcher.submit({
              projectId,
              paths: discardData.paths,
            });

            setDiscardData(null);
          }}
          onClose={() => setDiscardData(null)}
        />
      )}
      {isGitPullRequiredModalOpen && (
        <GitPullRequiredModal
          title="Pull Required"
          message="Your local branch is behind the remote. Pull the latest changes before pushing."
          okLabel="Pull & Push"
          onConfirm={() => {
            setIsGitPullRequiredModalOpen(false);
            onPushAfterPull();
          }}
          onClose={() => setIsGitPullRequiredModalOpen(false)}
        />
      )}
    </>
  );
};

interface ConfirmModalProps {
  message: string;
  onConfirm?: () => void;
  onClose?: () => void;
}

// TODO - refactor this to use the new modal system
const ConfirmDiscardModal = ({ message, onConfirm, onClose }: ConfirmModalProps) => {
  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose?.();
      }}
      isDismissable
      className="fixed left-0 top-[50%] z-10 flex h-[--visual-viewport-height] w-full translate-y-[-50%] items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose?.();
        }}
        className="flex w-full max-w-2xl flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none data-[loading]:animate-pulse">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  Discard Changes
                </Heading>

                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="">{message}</div>
              <div className="flex h-10 flex-shrink-0 items-center justify-end gap-2">
                <Button
                  className="h-full gap-2 rounded-md bg-[--color-bg] px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] aria-pressed:opacity-80"
                  onPress={() => close?.()}
                >
                  Cancel
                </Button>
                <Button
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
                  onPress={() => {
                    if (typeof onConfirm === 'function') {
                      onConfirm();
                    }
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
