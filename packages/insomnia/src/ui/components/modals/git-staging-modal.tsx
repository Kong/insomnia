import React, { type FC, useEffect } from 'react';
import { Button, Dialog, GridList, GridListItem, Heading, Label, Modal, ModalOverlay, TextArea, TextField, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import type { GitChangesLoaderData, GitDiffResult } from '../../routes/git-actions';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';
import { showAlert } from '.';

export const GitStagingModal: FC<{ onClose: () => void }> = ({
  onClose,
}) => {
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
    let url = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/diff`;
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
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/stage`,
        encType: 'application/json',
      }
    );
  }

  function unstageChanges(paths: string[]) {
    unstageChangesFetcher.submit(
      {
        paths,
      },
      {
        method: 'POST',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/unstage`,
        encType: 'application/json',
      }
    );
  }

  function undoUnstagedChanges(paths: string[]) {
    showAlert({
      message: 'Are you sure you want to undo your changes? This action cannot be undone and will revert all changes made since the last commit that are unstaged.',
      title: 'Undo changes',
      onConfirm: () => {
        undoUnstagedChangesFetcher.submit(
          {
            paths,
          },
          {
            method: 'POST',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/discard`,
            encType: 'application/json',
          }
        );
      },
      addCancel: true,
    });
  }

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      // file://./../../routes/git-actions.tsx#gitChangesLoader
      gitChangesFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/changes`);
    }
  }, [organizationId, projectId, workspaceId, gitChangesFetcher]);

  const {
    changes,
  } = gitChangesFetcher.data || {
      changes: {
        staged: [],
        unstaged: [],
      },
    branch: '',
    statusNames: {},
  };

  const { Form, formAction, state, data } = useFetcher<{ errors?: string[] }>();

  const isCreatingSnapshot = state === 'loading' && formAction === '/organization/:organizationId/project/:projectId/workspace/:workspaceId/git/commit';
  const isPushing = state === 'loading' && formAction === '/organization/:organizationId/project/:projectId/workspace/:workspaceId/git/commit-and-push';

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
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-[calc(100%-var(--padding-xl))] h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          data-loading={gitChangesFetcher.state === 'loading' ? 'true' : undefined}
          className="outline-none flex-1 h-full flex flex-col overflow-hidden data-[loading]:animate-pulse"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex-shrink-0 flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Commit changes</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className='grid [grid-template-columns:300px_1fr] h-full overflow-hidden divide-x divide-solid divide-[--hl-md] gap-2'>
                <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
                  <Form method="POST" className='flex flex-col gap-2'>
                    <TextField className="flex flex-col gap-2 flex-shrink-0">
                      <Label className='font-bold'>
                        Message
                      </Label>
                      <TextArea
                        rows={3}
                        name="message"
                        className="border border-solid border-[--hl-sm] placeholder:text-[--hl-md] rounded-sm p-2 resize-none"
                        placeholder="This is a helpful message that describes the changes made in this commit."
                        required
                      />
                    </TextField>

                    <div className="flex flex-shrink-0 justify-stretch gap-2 items-center">
                      <Button
                        type='submit'
                        isDisabled={state !== 'idle' || changes.staged.length === 0}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/commit`}
                        className="flex-1 flex h-8 items-center justify-center px-4 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      >
                        <Icon icon={isCreatingSnapshot ? 'spinner' : 'check'} className={`w-5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} /> Commit
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={state !== 'idle' || changes.staged.length === 0}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/commit-and-push`}
                        className="flex-1 flex h-8 items-center justify-center px-4 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      >
                        <Icon icon={isPushing ? 'spinner' : 'cloud-arrow-up'} className={`w-5 ${isPushing ? 'animate-spin' : ''}`} /> Commit and push
                      </Button>
                    </div>
                    {data && data.errors && data.errors.length > 0 && (
                      <p className="bg-opacity-20 text-sm text-[--color-font-danger] p-2 rounded-sm bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))]">
                        <Icon icon="exclamation-triangle" /> {data.errors.join('\n')}
                      </p>
                    )}
                  </Form>

                  <div className='grid auto-rows-auto gap-2 overflow-y-auto'>
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96 w-full'>
                      <Heading className='group font-semibold flex-shrink-0 w-full flex items-center gap-2 py-1 justify-between'>
                        <span className='flex-1'>Staged changes</span>
                        <TooltipTrigger>
                          <Button
                            className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base'
                            slot={null}
                            name='Unstage all changes'
                            onPress={() => {
                              unstageChanges(changes.staged.map(entry => entry.path));
                            }}
                          >
                            <Icon icon="minus" aria-hidden pointerEvents="none" />
                          </Button>
                          <Tooltip
                            offset={8}
                            className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                          >
                            Unstage all changes
                          </Tooltip>
                        </TooltipTrigger>
                        <span className='text-sm rounded-full size-6 flex items-center justify-center px-1 text-[--hl] bg-[--hl-sm]'>{changes.staged.length}</span>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={changes.staged.map(entry => ({
                            entry,
                            id: entry.path,
                            textValue: entry.path,
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            diffChanges({
                              path: key.toString(),
                              staged: true,
                            });
                          }}
                          renderEmptyState={() => (
                            <p className='p-2 text-[--hl] text-sm'>
                              Stage your changes to commit them.
                            </p>
                          )}
                        >
                          {item => {
                            return (
                              <GridListItem className="group outline-none select-none aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                                <span className='truncate'>{item.entry.name}</span>
                                <div className='flex items-center gap-1'>
                                  <TooltipTrigger>
                                    <Button
                                      className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
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
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
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
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96 w-full'>
                      <Heading className='group font-semibold flex-shrink-0 w-full flex items-center py-1 justify-between'>
                        <span>Changes</span>
                        <div className='flex items-center gap-2'>
                          <TooltipTrigger>
                            <Button
                              className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base'
                              slot={null}
                              name='Discard all changes'
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
                              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                            >
                              Discard all changes
                            </Tooltip>
                          </TooltipTrigger>
                          <TooltipTrigger>
                            <Button
                              className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] px-2 gap-2 rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base'
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
                              className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                            >
                              Stage all changes
                            </Tooltip>
                          </TooltipTrigger>
                          <span className='text-sm rounded-full size-6 flex items-center justify-center px-1 text-[--hl] bg-[--hl-sm]'>{changes.unstaged.length}</span>
                        </div>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={changes.unstaged.map(entry => ({
                            entry,
                            id: entry.path,
                            key: entry.path,
                            textValue: entry.path,
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            diffChanges({
                              path: key.toString(),
                              staged: false,
                            });
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group outline-none select-none aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                                <span className='truncate'>{item.entry.name}</span>
                                <div className='flex items-center gap-1'>
                                  <TooltipTrigger>
                                    <Button
                                      className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
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
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                    >
                                      Discard change
                                    </Tooltip>
                                  </TooltipTrigger>
                                  <TooltipTrigger>
                                    <Button
                                      className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
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
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
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
                {previewDiffItem?.diff ? <div className='p-2 pb-0 flex flex-col gap-2 h-full overflow-y-auto'>
                  <Heading className='font-bold flex items-center gap-2'>
                    <Icon icon="code-compare" />
                    {previewDiffItem.name}
                  </Heading>
                  {previewDiffItem && (
                    <div
                      className='bg-[--hl-xs] rounded-sm p-2 flex-1 overflow-y-auto text-[--color-font]'
                    >
                      <DiffEditor original={previewDiffItem.diff.before} modified={previewDiffItem.diff.after} />
                    </div>
                  )}
                </div> : <div className='p-2 h-full flex flex-col gap-4 items-center justify-center'>
                  <Heading className='font-semibold flex justify-center items-center gap-2 text-4xl text-[--hl-md]'>
                    <Icon icon="code-compare" />
                    Diff view
                  </Heading>
                  <p className='text-[--hl]'>
                    Select an item to compare
                  </p>
                </div>}
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
