import { type FC, useEffect } from 'react';
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
import { useGitProjectStageActionFetcher } from '~/routes/git.stage';
import { useGitProjectUnstageActionFetcher } from '~/routes/git.unstage';

import { DiffEditor } from '../diff-view-editor';
import { ConfigLink } from '../github-app-config-link';
import { Icon } from '../icon';
import { AlertModal } from './alert-modal';
import { showModal } from './index';

export const GitStagingModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const gitChangesFetcher = useGitProjectChangesFetcher();

  const stageChangesFetcher = useGitProjectStageActionFetcher();
  const unstageChangesFetcher = useGitProjectUnstageActionFetcher();
  const undoUnstagedChangesFetcher = useGitProjectUnstageActionFetcher();
  const diffChangesFetcher = useGitProjectDiffLoaderFetcher();

  function diffChanges({ path, staged }: { path: string; staged: boolean }) {
    diffChangesFetcher.load({
      filePath: path,
      projectId,
      staged,
      workspaceId,
    });
  }

  function stageChanges(paths: string[]) {
    stageChangesFetcher.submit({
      projectId,
      workspaceId,
      paths,
    });
  }

  function unstageChanges(paths: string[]) {
    unstageChangesFetcher.submit({
      projectId,
      workspaceId,
      paths,
    });
  }

  function undoUnstagedChanges(paths: string[], filesCount: number) {
    showModal(AlertModal, {
      message: `Are you sure you want to discard ${filesCount === 1 ? 'your changes to this file' : `your changes to these ${filesCount} files`}? This action cannot be undone and will discard any changes since your last commit.`,
      title: 'Discard changes',
      okLabel: 'Discard',
      onConfirm: () => {
        undoUnstagedChangesFetcher.submit({
          projectId,
          workspaceId,
          paths,
        });
      },
      addCancel: true,
    });
  }

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      gitChangesFetcher.load({
        projectId,
        workspaceId,
      });
    }
  }, [projectId, workspaceId, gitChangesFetcher]);

  const { changes } = gitChangesFetcher.data || {
    changes: {
      staged: [],
      unstaged: [],
    },
    branch: '',
    statusNames: {},
  };

  const commitFetcher = useGitProjectCommitActionFetcher();

  const isCommiting = commitFetcher.state !== 'idle';

  const previewDiffItem = diffChangesFetcher.data && 'diff' in diffChangesFetcher.data ? diffChangesFetcher.data : null;

  const allChanges = [...changes.staged, ...changes.unstaged];
  const allChangesLength = allChanges.length;
  const hasNoCommitErrors =
    commitFetcher.data && 'errors' in commitFetcher.data && commitFetcher.data.errors?.length === 0;

  useEffect(() => {
    if (allChangesLength === 0 && hasNoCommitErrors) {
      onClose();
    }
  }, [allChangesLength, onClose, hasNoCommitErrors]);

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog
          data-loading={gitChangesFetcher.state === 'loading' ? 'true' : undefined}
          className="flex h-full flex-1 flex-col overflow-hidden outline-hidden data-loading:animate-pulse"
        >
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Commit changes
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="grid h-full grid-cols-[300px_1fr] gap-2 divide-x divide-solid divide-(--hl-md) overflow-hidden">
                <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                  <form
                    onSubmit={e => {
                      e.preventDefault();

                      const submitter = e.nativeEvent instanceof SubmitEvent ? e.nativeEvent.submitter : null;
                      const formData = new FormData(e.currentTarget, submitter);

                      const message = formData.get('message')?.toString() || '';
                      const push = Boolean(formData.get('push') === 'true');

                      commitFetcher.submit({
                        projectId,
                        workspaceId,
                        message,
                        push,
                      });
                    }}
                    className="flex flex-col gap-2"
                  >
                    <TextField className="flex shrink-0 flex-col gap-2">
                      <Label className="font-bold">Message</Label>
                      <TextArea
                        rows={3}
                        name="message"
                        className="resize-none rounded-xs border border-solid border-(--hl-sm) p-2 placeholder:text-(--hl-md)"
                        placeholder="This is a helpful message that describes the changes made in this commit."
                        required
                      />
                    </TextField>

                    <div className="flex shrink-0 items-center justify-stretch gap-2">
                      <Button
                        type="submit"
                        isDisabled={isCommiting || changes.staged.length === 0}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/commit`}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon
                          icon={isCommiting ? 'spinner' : 'check'}
                          className={`w-5 ${isCommiting ? 'animate-spin' : ''}`}
                        />{' '}
                        Commit
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={isCommiting || changes.staged.length === 0}
                        name="push"
                        value="true"
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon
                          icon={isCommiting ? 'spinner' : 'cloud-arrow-up'}
                          className={`w-5 ${isCommiting ? 'animate-spin' : ''}`}
                        />{' '}
                        Commit and push
                      </Button>
                    </div>
                    {commitFetcher.data && commitFetcher.data.errors && commitFetcher.data.errors.length > 0 && (
                      <p className="rounded-xs bg-(--color-danger)/20 p-2 text-sm text-(--color-font-danger)">
                        <Icon icon="exclamation-triangle" /> {commitFetcher.data.errors.join('\n')}
                        <ConfigLink small {...commitFetcher.data} />
                      </p>
                    )}
                  </form>

                  <div className="grid auto-rows-auto gap-2 overflow-y-auto">
                    <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
                      <Heading className="group flex w-full shrink-0 items-center justify-between gap-2 py-1 font-semibold">
                        <span className="flex-1">Staged changes</span>
                        <TooltipTrigger>
                          <Button
                            className="flex aspect-square h-6 items-center justify-center rounded-xs text-base text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                            className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                          >
                            Unstage all changes
                          </Tooltip>
                        </TooltipTrigger>
                        <span className="flex size-6 items-center justify-center rounded-full bg-(--hl-sm) px-1 text-sm text-(--hl)">
                          {changes.staged.length}
                        </span>
                      </Heading>
                      <div className="flex w-full flex-1 overflow-y-auto select-none">
                        <GridList
                          className="w-full"
                          items={changes.staged.map(entry => ({
                            entry,
                            id: entry.path,
                            textValue: entry.path,
                          }))}
                          aria-label="Unstaged changes"
                          onAction={key => {
                            diffChanges({
                              path: key.toString(),
                              staged: true,
                            });
                          }}
                          renderEmptyState={() => (
                            <p className="p-2 text-sm text-(--hl)">Stage your changes to commit them.</p>
                          )}
                        >
                          {item => {
                            return (
                              <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                <span className="truncate">{item.entry.name}</span>
                                <div className="flex items-center gap-1">
                                  <TooltipTrigger>
                                    <Button
                                      className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
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
                                      className="border select-none text-sm max-w-xs border-solid border-(--hl-sm) shadow-lg bg-(--color-bg) text-(--color-font) px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-hidden"
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
                      <Heading className="group flex w-full shrink-0 items-center justify-between py-1 font-semibold">
                        <span>Changes</span>
                        <div className="flex items-center gap-2">
                          <TooltipTrigger>
                            <Button
                              className="flex aspect-square h-6 items-center justify-center rounded-xs text-base text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                              slot={null}
                              name="Discard all changes"
                              onPress={() => {
                                undoUnstagedChanges(
                                  changes.unstaged.map(entry => entry.path),
                                  changes.unstaged.length,
                                );
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
                              className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                            >
                              Discard all changes
                            </Tooltip>
                          </TooltipTrigger>
                          <TooltipTrigger>
                            <Button
                              className="flex aspect-square h-6 items-center justify-center gap-2 rounded-xs px-2 text-base text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                              className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                            >
                              Stage all changes
                            </Tooltip>
                          </TooltipTrigger>
                          <span className="flex size-6 items-center justify-center rounded-full bg-(--hl-sm) px-1 text-sm text-(--hl)">
                            {changes.unstaged.length}
                          </span>
                        </div>
                      </Heading>
                      <div className="flex w-full flex-1 overflow-y-auto select-none">
                        <GridList
                          className="w-full"
                          items={changes.unstaged.map(entry => ({
                            entry,
                            id: entry.path,
                            key: entry.path,
                            textValue: entry.path,
                          }))}
                          aria-label="Unstaged changes"
                          onAction={key => {
                            diffChanges({
                              path: key.toString(),
                              staged: false,
                            });
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                <span className="truncate">{item.entry.name}</span>
                                <div className="flex items-center gap-1">
                                  <TooltipTrigger>
                                    <Button
                                      className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                                      slot={null}
                                      name="Discard change"
                                      onPress={() => {
                                        undoUnstagedChanges([item.entry.path], 1);
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
                                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                                    >
                                      Discard change
                                    </Tooltip>
                                  </TooltipTrigger>
                                  <TooltipTrigger>
                                    <Button
                                      className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
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
                                      className="border select-none text-sm max-w-xs border-solid border-(--hl-sm) shadow-lg bg-(--color-bg) text-(--color-font) px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-hidden"
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
                      <div className="flex-1 overflow-y-auto rounded-xs bg-(--hl-xs) p-2 text-(--color-font)">
                        <DiffEditor original={previewDiffItem.diff.before} modified={previewDiffItem.diff.after} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-4 p-2">
                    <Heading className="flex items-center justify-center gap-2 text-4xl font-semibold text-(--hl-md)">
                      <Icon icon="code-compare" />
                      View diff
                    </Heading>
                    <p className="text-(--hl)">Select a file to compare changes</p>
                    <p className="text-sm text-(--hl-md)">
                      Changes may include modifications you made and automatic updates like timestamps
                    </p>
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
