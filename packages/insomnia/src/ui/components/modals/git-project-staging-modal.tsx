import React, { type FC, useEffect } from 'react';
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
import { useFetcher, useParams } from 'react-router';

import type { GitChangesLoaderData, GitDiffResult } from '../../routes/git-project-actions';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';
import { showAlert } from '.';

export const GitProjectStagingModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const gitChangesFetcher = useFetcher<GitChangesLoaderData>();

  const stageChangesFetcher = useFetcher<{
    errors?: string[];
  }>();
  const unstageChangesFetcher = useFetcher<{
    errors?: string[];
  }>();
  const undoUnstagedChangesFetcher = useFetcher<{
    errors?: string[];
  }>();
  const diffChangesFetcher = useFetcher<GitDiffResult>();

  function diffChanges({ path, staged }: { path: string; staged: boolean }) {
    let url = `/organization/${organizationId}/project/${projectId}/git/diff`;
    const params = new URLSearchParams();
    params.set('filepath', path);
    params.set('staged', staged ? 'true' : 'false');
    url += '?' + params.toString();
    diffChangesFetcher.load(`${url}`);
  }

  function stageChanges(paths: string[]) {
    stageChangesFetcher.submit(
      {
        paths,
      },
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/git/stage`,
        encType: 'application/json',
      },
    );
  }

  function unstageChanges(paths: string[]) {
    unstageChangesFetcher.submit(
      {
        paths,
      },
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/git/unstage`,
        encType: 'application/json',
      },
    );
  }

  function undoUnstagedChanges(paths: string[]) {
    showAlert({
      message:
        'Are you sure you want to undo your changes? This action cannot be undone and will revert all changes made since the last commit that are unstaged.',
      title: 'Undo changes',
      onConfirm: () => {
        undoUnstagedChangesFetcher.submit(
          {
            paths,
          },
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/git/discard`,
            encType: 'application/json',
          },
        );
      },
      addCancel: true,
    });
  }

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      // file://./../../routes/git-actions.tsx#gitChangesLoader
      gitChangesFetcher.load(`/organization/${organizationId}/project/${projectId}/git/changes`);
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

  const { Form, formAction, state, data } = useFetcher<{ errors?: string[] }>();

  const isCreatingSnapshot =
    state !== 'idle' && formAction === `/organization/${organizationId}/project/${projectId}/git/commit`;
  const isPushing =
    state !== 'idle' && formAction === `/organization/${organizationId}/project/${projectId}/git/commit-and-push`;
  const previewDiffItem = diffChangesFetcher.data && 'diff' in diffChangesFetcher.data ? diffChangesFetcher.data : null;

  const allChanges = [...changes.staged, ...changes.unstaged];
  const allChangesLength = allChanges.length;
  const noCommitErrors = data && 'errors' in data && data.errors?.length === 0;

  useEffect(() => {
    if (allChangesLength === 0 && noCommitErrors) {
      onClose();
    }
  }, [allChangesLength, onClose, noCommitErrors]);

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
        className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog
          data-loading={gitChangesFetcher.state === 'loading' ? 'true' : undefined}
          className="flex h-full flex-1 flex-col overflow-hidden outline-none data-[loading]:animate-pulse"
        >
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Commit changes{' '}
                  {gitChangesFetcher.state === 'loading' && <Icon icon="spinner" className="animate-spin" />}
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="grid h-full gap-2 divide-x divide-solid divide-[--hl-md] overflow-hidden [grid-template-columns:300px_1fr]">
                <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                  <Form method="POST" className="flex flex-col gap-2">
                    <TextField className="flex flex-shrink-0 flex-col gap-2">
                      <Label className="font-bold">Message</Label>
                      <TextArea
                        rows={3}
                        name="message"
                        className="resize-none rounded-sm border border-solid border-[--hl-sm] p-2 placeholder:text-[--hl-md]"
                        placeholder="This is a helpful message that describes the changes made in this commit."
                        required
                      />
                    </TextField>

                    <div className="flex flex-shrink-0 items-center justify-stretch gap-2">
                      <Button
                        type="submit"
                        isDisabled={state !== 'idle' || changes.staged.length === 0}
                        formAction={`/organization/${organizationId}/project/${projectId}/git/commit`}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      >
                        <Icon
                          icon={isCreatingSnapshot ? 'spinner' : 'check'}
                          className={`w-5 ${isCreatingSnapshot ? 'animate-spin' : ''}`}
                        />{' '}
                        Commit
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={state !== 'idle' || changes.staged.length === 0}
                        formAction={`/organization/${organizationId}/project/${projectId}/git/commit-and-push`}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      >
                        <Icon
                          icon={isPushing ? 'spinner' : 'cloud-arrow-up'}
                          className={`w-5 ${isPushing ? 'animate-spin' : ''}`}
                        />{' '}
                        Commit and push
                      </Button>
                    </div>
                    {data && data.errors && data.errors.length > 0 && (
                      <p className="rounded-sm bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))] bg-opacity-20 p-2 text-sm text-[--color-font-danger]">
                        <Icon icon="exclamation-triangle" /> {data.errors.join('\n')}
                      </p>
                    )}
                  </Form>

                  <div className="grid auto-rows-auto gap-2 overflow-y-auto">
                    <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
                      <Heading className="group flex w-full flex-shrink-0 items-center justify-between gap-2 py-1 font-semibold">
                        <span className="flex-1">Staged changes</span>
                        <TooltipTrigger>
                          <Button
                            className="flex aspect-square h-6 items-center justify-center rounded-sm text-base text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                            slot={null}
                            name="Unstage all changes"
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
                                <span className="truncate">{item.entry.path}</span>
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
                                  {/* <TooltipTrigger>
                                    <Button className="cursor-default">
                                      {'added' in item.entry ? 'U' : 'deleted' in item.entry ? 'D' : 'M'}
                                    </Button>
                                    <Tooltip
                                      offset={8}
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                    >
                                      {'added' in item.entry ? 'Untracked' : 'deleted' in item.entry ? 'Deleted' : 'Modified'}
                                    </Tooltip>
                                  </TooltipTrigger> */}
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
                              className="flex aspect-square h-6 items-center justify-center rounded-sm text-base text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                              slot={null}
                              name="Discard all changes"
                              onPress={() => {
                                undoUnstagedChanges(changes.unstaged.map(entry => entry.path));
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
                              className="flex aspect-square h-6 items-center justify-center gap-2 rounded-sm px-2 text-base text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                              slot={null}
                              name="Stage all changes"
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
                                <span className="truncate">{item.entry.path}</span>
                                <div className="flex items-center gap-1">
                                  <TooltipTrigger>
                                    <Button
                                      className="flex aspect-square h-6 items-center justify-center rounded-sm text-sm text-[--color-font] opacity-0 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] hover:opacity-100 focus:opacity-100 focus:ring-inset focus:ring-[--hl-md] group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 aria-pressed:bg-[--hl-sm] data-[pressed]:opacity-100"
                                      slot={null}
                                      name="Discard change"
                                      onPress={() => {
                                        undoUnstagedChanges([item.entry.path]);
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
                                  {/* <TooltipTrigger>
                                    <Button className="cursor-default">
                                      {'added' in item.entry ? 'U' : 'deleted' in item.entry ? 'D' : 'M'}
                                    </Button>
                                    <Tooltip
                                      offset={8}
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                    >
                                      {'added' in item.entry ? 'Untracked' : 'deleted' in item.entry ? 'Deleted' : 'Modified'}
                                    </Tooltip>
                                  </TooltipTrigger> */}
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
  );
};
