import React, { type FC, type ReactNode, useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  isTextDropItem,
  Label,
  Modal,
  ModalOverlay,
  TextArea,
  TextField,
  Tooltip,
  TooltipTrigger,
  useDragAndDrop,
} from 'react-aria-components';
import { useParams } from 'react-router';
import { type TreeData, useTreeData } from 'react-stately';

import { useAIGenerateActionFetcher } from '~/routes/ai.generate-commit-messages';
import { useGitProjectChangesFetcher } from '~/routes/git.changes';
import { useGitProjectCommitActionFetcher } from '~/routes/git.commit';
import { useGitProjectCommitsActionFetcher } from '~/routes/git.commits';
import { useGitProjectDiffLoaderFetcher } from '~/routes/git.diff';
import { useGitProjectDiscardActionFetcher } from '~/routes/git.discard';
import { useGitProjectStageActionFetcher } from '~/routes/git.stage';
import { useGitProjectUnstageActionFetcher } from '~/routes/git.unstage';
import type { GitFileType } from '~/sync/git/git-vcs';
import { GitVCSOperationErrors } from '~/sync/git/git-vcs-operation-errors';
import { SegmentEvent } from '~/ui/analytics';
import { Badge } from '~/ui/components/base/badge';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';
import { SvgIcon } from '~/ui/components/svg-icon';
import { useAIFeatureStatus } from '~/ui/hooks/use-organization-features';

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

function getModificationClassName(type: GitFileType) {
  if (!type) {
    return '';
  }

  if (type === 'added') {
    return 'text-[#73c991]';
  }

  if (type === 'deleted') {
    return 'text-[#f14c4c]';
  }

  if (type === 'modified') {
    return 'text-[#e2c08d]';
  }

  if (type === 'renamed') {
    return 'text-[#519aba]';
  }

  if (type === 'copied') {
    return 'text-[#4ec9b0]';
  }

  if (type === 'untracked') {
    return 'text-[#73c991]';
  }

  if (type === 'ignored') {
    return 'text-[#8c8c8c]';
  }

  if (type === 'conflicted') {
    return 'text-[#d670d6]';
  }

  return '';
}

interface GeneratedCommitsFormProps {
  commits: { id: string; message: string; files: string[] }[];
  projectId: string;
  mode: StagingModalMode;
  changes: { staged: any[]; unstaged: any[] };
  setShowConfirmDiscardAndPullModal: (show: boolean) => void;
  onCommitSuccess: () => void;
  diffChanges: (params: { path: string; staged: boolean }) => void;
}

interface FileItem {
  id: string;
  name: string;
  type: string;
  symbol: string;
}

interface CommitItem {
  id: string;
  name: string;
  files?: FileItem[];
}

type TreeItem = CommitItem | FileItem;

const DO_NOT_COMMIT_ID = 'do-not-commit';

const CommitSection = (props: {
  id: string;
  commitsSections: TreeData<CommitItem>;
  files: TreeData<TreeItem>['items'];
  emptyState?: ReactNode;
  isDoNotCommitSection?: boolean;
  diffChanges: (params: { path: string; staged: boolean }) => void;
  onMoveToDoNotCommit?: (fileItem: FileItem) => void;
}) => {
  const { dragAndDropHooks } = useDragAndDrop({
    // Provide drag data in a custom format as well as plain text.
    getItems(keys) {
      const filesKeys = props.files
        .filter(item => keys.has(item.value.id))
        .map(item => {
          return {
            'insomnia:git-commit-item': JSON.stringify(item),
            'text/plain': item.value.name,
          };
        });

      return filesKeys;
    },

    // Accept drops with the custom format.
    acceptedDragTypes: ['insomnia:git-commit-item'],

    // Ensure items are always moved rather than copied.
    getDropOperation: () => 'move',

    // Handle drops between items from other lists.
    // async onInsert(e) {
    //   const processedItems = await Promise.all(
    //     e.items.filter(isTextDropItem).map(async item => JSON.parse(await item.getText('insomnia:git-commit-item'))),
    //   );
    //   if (e.target.dropPosition === 'before') {
    //     props.commitsSections.insertBefore(e.target.key, ...processedItems.map(item => item.value));
    //   } else if (e.target.dropPosition === 'after') {
    //     props.commitsSections.insertAfter(e.target.key, ...processedItems.map(item => item.value));
    //   }
    // },

    // Handle drops on the collection when empty.
    async onRootDrop(e) {
      const processedItems = await Promise.all(
        e.items.filter(isTextDropItem).map(async item => JSON.parse(await item.getText('insomnia:git-commit-item'))),
      );
      props.commitsSections.remove(...processedItems.map(item => item.value.id));
      props.commitsSections.append(props.id, ...processedItems.map(item => item.value));
    },

    // Handle reordering items within the same list.
    onReorder(e) {
      if (e.target.dropPosition === 'before') {
        props.commitsSections.moveBefore(e.target.key, e.keys);
      } else if (e.target.dropPosition === 'after') {
        props.commitsSections.moveAfter(e.target.key, e.keys);
      }
    },
  });

  return (
    <GridList
      renderEmptyState={() => {
        if (props.emptyState) {
          return props.emptyState;
        }

        return <p className="p-2 text-sm text-(--hl)">No files to commit. This commit will be ignored.</p>;
      }}
      className="w-full"
      aria-label="Files to commit"
      items={props.files}
      dragAndDropHooks={dragAndDropHooks}
      onAction={key => {
        const id = props.files.find(item => item.key === key)?.value.name;
        if (id) {
          props.diffChanges({ path: id, staged: false });
        }
      }}
    >
      {item => {
        const fileItem = item.value as FileItem;

        return (
          <GridListItem className="group flex w-full items-center gap-2 overflow-hidden py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
            <Button slot="drag" className="cursor-move">
              <Icon icon="grip-vertical" className="size-4" />
            </Button>
            <div className="flex w-full items-center justify-between overflow-hidden">
              <span className={`truncate ${fileItem.type === 'deleted' ? 'line-through' : ''}`}>{fileItem.name}</span>
              <div className="flex items-center gap-1">
                {!props.isDoNotCommitSection && (
                  <TooltipTrigger>
                    <Button
                      className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                      slot={null}
                      name="Do not commit"
                      onPress={() => {
                        props.onMoveToDoNotCommit?.(fileItem);
                      }}
                    >
                      <Icon icon="minus" aria-hidden pointerEvents="none" />
                    </Button>
                    <Tooltip
                      offset={8}
                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                    >
                      Do not commit
                    </Tooltip>
                  </TooltipTrigger>
                )}
                <TooltipTrigger>
                  <Button
                    className={`cursor-default text-sm ${getModificationClassName(fileItem.type as GitFileType)}`}
                  >
                    {fileItem.symbol}
                  </Button>
                  <Tooltip
                    offset={8}
                    className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) capitalize shadow-lg select-none focus:outline-hidden"
                  >
                    {fileItem.type}
                  </Tooltip>
                </TooltipTrigger>
              </div>
            </div>
          </GridListItem>
        );
      }}
    </GridList>
  );
};

const GeneratedCommitsForm: FC<GeneratedCommitsFormProps> = ({
  commits,
  projectId,
  mode,
  changes,
  setShowConfirmDiscardAndPullModal,
  onCommitSuccess,
  diffChanges,
}) => {
  const commitsFetcher = useGitProjectCommitsActionFetcher();
  const [committingAction, setCommittingAction] = useState<'commit' | 'commit-push' | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isCommitting = commitsFetcher.state !== 'idle';
  const canCommitAndPull = changes.staged.length > 0 && changes.unstaged.length === 0;

  // Handle successful commits
  useEffect(() => {
    const hasNoCommitErrors =
      commitsFetcher.data && 'errors' in commitsFetcher.data && commitsFetcher.data.errors?.length === 0;
    if (hasNoCommitErrors) {
      onCommitSuccess();
    }
  }, [commitsFetcher.data, onCommitSuccess]);

  const moveFileToDoNotCommit = (fileItem: FileItem) => {
    try {
      commitsSections.remove(fileItem.id);
      commitsSections.append(DO_NOT_COMMIT_ID, fileItem);

      // Force re-render by updating refresh key
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error moving file:', error);
    }
  };

  const commitsSections = useTreeData<CommitItem>({
    initialItems: commits
      .map(commit => ({
        id: commit.id,
        name: commit.message,
        files: commit.files.map(file => ({
          id: `${commit.id}:${file}`,
          name: file,
          type: changes.staged.find(change => change.path === file)?.type || 'modified',
          symbol: changes.staged.find(change => change.path === file)?.symbol || 'M',
        })),
      }))
      .concat({
        id: DO_NOT_COMMIT_ID,
        name: 'Do not commit',
        files: [],
      }),
    getKey: item => item.id,
    getChildren: item => item.files || [],
  });

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const submitter = e.nativeEvent instanceof SubmitEvent ? e.nativeEvent.submitter : null;
        const formData = new FormData(e.currentTarget, submitter);

        const push = Boolean(formData.get('push') === 'true');

        setCommittingAction(push ? 'commit-push' : 'commit');

        const commits = commitsSections.items
          .map(commit => ({
            id: commit.value.id,
            message: commit.value.name,
            files: commit.children?.map(file => file.value.name) || [],
          }))
          .filter(commit => commit.id !== DO_NOT_COMMIT_ID && commit.files.length > 0);

        window.main.trackSegmentEvent({
          event: SegmentEvent.recommendCommitsSaved,
          properties: {
            group_count: commits.length,
            file_excluded_count: commitsSections.getItem(DO_NOT_COMMIT_ID)?.value?.files?.length || 0,
          },
        });
        commitsFetcher.submit({
          projectId,
          commits: commits.map(commit => ({
            message: commit.message,
            files: commit.files,
          })),
          push,
        });
      }}
      className="flex flex-1 flex-col gap-6 overflow-hidden"
    >
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-2">
        {commitsSections.items.map((commit, index) => (
          <div
            key={commit.key}
            className={`relative flex shrink-0 flex-col gap-2 rounded-md border border-solid border-(--hl-sm) p-3 ${commit.children?.length === 0 ? 'opacity-50' : ''}`}
          >
            <span className="absolute -top-3 left-2 flex w-fit gap-1 bg-(--color-bg) px-2">
              <SvgIcon icon="sparkles" style={{ color: `rgb(var(--color-surprise-rgb))` }} />
              {commit.value.id === DO_NOT_COMMIT_ID ? 'Do not commit' : `Commit ${index + 1}`}
            </span>
            {commit.value.id !== DO_NOT_COMMIT_ID && (
              <TextField
                className="flex flex-col gap-2"
                defaultValue={commit.value.name}
                isDisabled={isCommitting || commit.children?.length === 0}
                onChange={value => {
                  commitsSections.update(commit.key, { ...commit.value, name: value });
                }}
              >
                <Label>Message</Label>
                <TextArea
                  rows={2}
                  name="message"
                  className="resize-none rounded-xs border border-solid border-(--hl-sm) p-2 placeholder:text-(--hl-md)"
                  placeholder="This is a helpful message that describes the changes made in this commit."
                />
              </TextField>
            )}
            <div className="pt-2">
              <span>Files ({commit.children?.length || 0})</span>
              <div className="py-1">
                <CommitSection
                  key={`${commit.key}-${refreshKey}`}
                  id={commit.key.toString()}
                  files={commitsSections.getItem(commit.key)?.children || []}
                  isDoNotCommitSection={commit.value.id === DO_NOT_COMMIT_ID}
                  commitsSections={commitsSections}
                  diffChanges={diffChanges}
                  onMoveToDoNotCommit={moveFileToDoNotCommit}
                  emptyState={
                    commit.value.id !== DO_NOT_COMMIT_ID ? (
                      <p className="p-2 text-sm text-(--hl)">No files to commit. This commit will be ignored.</p>
                    ) : (
                      <p className="p-2 text-sm text-(--hl)">These files will not be committed.</p>
                    )
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {mode === StagingModalModes.commitAndPull ? (
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            isDisabled={isCommitting || changes.staged.length === 0}
            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
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
            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            onPress={() => {
              setShowConfirmDiscardAndPullModal(true);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M5.828 7l2.536 2.535L6.95 10.95 2 6l4.95-4.95 1.414 1.415L5.828 5H13a8 8 0 110 16H4v-2h9a6 6 0 000-12H5.828z" />
            </svg>
            Discard and pull
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center justify-stretch gap-2">
          <Button
            type="submit"
            isDisabled={committingAction === 'commit' && isCommitting}
            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon
              icon={committingAction === 'commit' && isCommitting ? 'spinner' : 'check'}
              className={`w-5 ${committingAction === 'commit' && isCommitting ? 'animate-spin' : ''}`}
            />{' '}
            Commit
          </Button>

          <Button
            type="submit"
            isDisabled={committingAction === 'commit-push' && isCommitting}
            name="push"
            value="true"
            className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon
              icon={committingAction === 'commit-push' && isCommitting ? 'spinner' : 'cloud-arrow-up'}
              className={`w-5 ${committingAction === 'commit-push' && isCommitting ? 'animate-spin' : ''}`}
            />{' '}
            Commit and push
          </Button>
        </div>
      )}
    </form>
  );
};

interface ManualCommitFormProps {
  projectId: string;
  mode: StagingModalMode;
  changes: { staged: any[]; unstaged: any[] };
  setShowConfirmDiscardAndPullModal: (show: boolean) => void;
  onCommitSuccess: () => void;
  onPullRequired: () => void;
  diffChanges: (params: { path: string; staged: boolean }) => void;
  setDiscardData: (data: { paths: string[]; filesCount: number }) => void;
}

const ManualCommitForm: FC<ManualCommitFormProps> = ({
  projectId,
  mode,
  changes,
  setShowConfirmDiscardAndPullModal,
  onCommitSuccess,
  onPullRequired,
  diffChanges,
  setDiscardData,
}) => {
  const commitFetcher = useGitProjectCommitActionFetcher();
  const stageChangesFetcher = useGitProjectStageActionFetcher();
  const unstageChangesFetcher = useGitProjectUnstageActionFetcher();

  const stagedCount = changes.staged.length;
  const unstagedCount = changes.unstaged.length;
  const [message, setMessage] = useState('');
  const [committingAction, setCommittingAction] = useState<'commit' | 'commit-push' | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const isCommitting = commitFetcher.state !== 'idle';
  const canCommitAndPull = stagedCount > 0 && unstagedCount === 0;

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

  const hasNoCommitErrors =
    commitFetcher.data && 'errors' in commitFetcher.data && commitFetcher.data.errors?.length === 0;

  // Handle commit results (errors and success)
  useEffect(() => {
    if (commitFetcher.data) {
      if (commitFetcher.data.errors && commitFetcher.data.errors.length > 0) {
        if (commitFetcher.data.errors.includes(GitVCSOperationErrors.RequiredPullRemoteChangesError)) {
          onPullRequired();
        } else {
          setOperationError(commitFetcher.data.errors.join('\n'));
        }
      } else if (hasNoCommitErrors) {
        setMessage('');
        setOperationError(null);
        onCommitSuccess();
      }
    }
  }, [commitFetcher.data, hasNoCommitErrors, onCommitSuccess, onPullRequired]);

  return (
    <>
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
        <TextField className="flex shrink-0 flex-col gap-2">
          <Label className="font-bold">Message</Label>
          <TextArea
            rows={3}
            name="message"
            className="text-md resize-none rounded-xs border border-solid border-(--hl-sm) p-2 placeholder:text-(--hl-md)"
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
              isDisabled={isCommitting || stagedCount === 0}
              className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
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
              className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              onPress={() => {
                setShowConfirmDiscardAndPullModal(true);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M5.828 7l2.536 2.535L6.95 10.95 2 6l4.95-4.95 1.414 1.415L5.828 5H13a8 8 0 110 16H4v-2h9a6 6 0 000-12H5.828z" />
              </svg>
              Discard and pull
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center justify-stretch gap-2">
            <Button
              type="submit"
              isDisabled={(committingAction === 'commit' && isCommitting) || stagedCount === 0}
              className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            >
              <Icon
                icon={committingAction === 'commit' && isCommitting ? 'spinner' : 'check'}
                className={`w-5 ${committingAction === 'commit' && isCommitting ? 'animate-spin' : ''}`}
              />{' '}
              Commit
            </Button>

            <Button
              type="submit"
              isDisabled={(committingAction === 'commit-push' && isCommitting) || stagedCount === 0}
              name="push"
              value="true"
              className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
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
          <p className="rounded-xs bg-(--color-danger)/20 p-2 text-sm text-(--color-font-danger)">
            <Icon icon="exclamation-triangle" /> {operationError}
          </p>
        )}
      </form>

      <div className="grid auto-rows-auto gap-2 overflow-y-auto">
        <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
          <Heading className="group flex w-full shrink-0 items-center justify-between gap-2 py-1 font-semibold">
            <span className="flex-1">Staged changes</span>
            <TooltipTrigger>
              <Button
                className="flex aspect-square h-6 items-center justify-center rounded-xs text-base text-(--color-font) opacity-100 ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:text-[rgba(var(--color-font-rgb),0.5)] aria-pressed:bg-(--hl-sm)"
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
              aria-label="Staged changes"
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
              renderEmptyState={() => <p className="p-2 text-sm text-(--hl)">Stage your changes to commit them.</p>}
            >
              {item => {
                return (
                  <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                    <span className={`truncate ${item.entry.type === 'deleted' ? 'line-through' : ''}`}>
                      {item.entry.path}
                    </span>
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
                      <TooltipTrigger>
                        <Button className={`cursor-default text-sm ${getModificationClassName(item.entry.type)}`}>
                          {item.entry.symbol}
                        </Button>
                        <Tooltip
                          offset={8}
                          className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) capitalize shadow-lg select-none focus:outline-hidden"
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
          <Heading className="group flex w-full shrink-0 items-center justify-between py-1 font-semibold">
            <span>Changes</span>
            <div className="flex items-center gap-2">
              <TooltipTrigger>
                <Button
                  className="flex aspect-square h-6 items-center justify-center rounded-xs text-base text-(--color-font) opacity-100 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:text-[rgba(var(--color-font-rgb),0.5)] aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
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
                  className="flex aspect-square h-6 items-center justify-center gap-2 rounded-xs px-2 text-base text-(--color-font) opacity-100 ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:text-[rgba(var(--color-font-rgb),0.5)] aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                  <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                    <span className={`truncate ${item.entry.type === 'deleted' ? 'line-through' : ''}`}>
                      {item.entry.path}
                    </span>
                    <div className="flex items-center gap-1">
                      <TooltipTrigger>
                        <Button
                          className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
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
                      <TooltipTrigger>
                        <Button className={`cursor-default text-sm ${getModificationClassName(item.entry.type)}`}>
                          {item.entry.symbol}
                        </Button>
                        <Tooltip
                          offset={8}
                          className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) capitalize shadow-lg select-none focus:outline-hidden"
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
    </>
  );
};

export const GitProjectStagingModal: FC<{
  mode?: StagingModalMode;
  onClose: () => void;
  onPullAfterCommit: () => void;
  onPushAfterPull: () => void;
}> = ({ mode = StagingModalModes.default, onClose, onPullAfterCommit, onPushAfterPull }) => {
  const { projectId } = useParams() as { projectId: string };

  const [commitGenerationKey, setCommitGenerationKey] = useState(0);

  const [isGitPullRequiredModalOpen, setIsGitPullRequiredModalOpen] = useState(false);
  const [showConfirmDiscardAndPullModal, setShowConfirmDiscardAndPullModal] = React.useState(false);
  const [discardData, setDiscardData] = React.useState<DiscardData | null>(null);

  const gitChangesFetcher = useGitProjectChangesFetcher();

  const undoUnstagedChangesFetcher = useGitProjectDiscardActionFetcher();
  const diffChangesFetcher = useGitProjectDiffLoaderFetcher();

  const { isGenerateCommitMessagesWithAIEnabled } = useAIFeatureStatus();

  function diffChanges({ path, staged }: { path: string; staged: boolean }) {
    diffChangesFetcher.load({
      projectId,
      filePath: path,
      staged,
    });
  }

  useEffect(() => {
    if (gitChangesFetcher.state === 'idle' && !gitChangesFetcher.data) {
      gitChangesFetcher.load({
        projectId,
      });
    }
  }, [projectId, gitChangesFetcher]);

  const { changes } = gitChangesFetcher.data || {
    changes: {
      staged: [],
      unstaged: [],
    },
    branch: '',
    statusNames: {},
  };

  const previewDiffItem = diffChangesFetcher.data && 'diff' in diffChangesFetcher.data ? diffChangesFetcher.data : null;

  const allChanges = [...changes.staged, ...changes.unstaged];
  const allChangesLength = allChanges.length;

  // Callback when commit succeeds - check if we should close the modal
  const handleCommitSuccess = React.useCallback(() => {
    // Check if there are no more changes left after commit
    if (allChangesLength === 0) {
      if (mode === StagingModalModes.commitAndPull) {
        onPullAfterCommit();
      }
      onClose();
    }
  }, [allChangesLength, mode, onPullAfterCommit, onClose]);

  // Callback when pull is required
  const handlePullRequired = React.useCallback(() => {
    setIsGitPullRequiredModalOpen(true);
  }, []);

  const generateCommitsFetcher = useAIGenerateActionFetcher({ key: commitGenerationKey.toString() });
  const isGeneratingCommits = generateCommitsFetcher.state !== 'idle';
  useEffect(() => {
    if (
      undoUnstagedChangesFetcher.data &&
      'success' in undoUnstagedChangesFetcher.data &&
      undoUnstagedChangesFetcher.data.success &&
      allChangesLength === 0
    ) {
      onClose();
    }
  }, [allChangesLength, onClose, undoUnstagedChangesFetcher.data]);

  const commitGenerationCompleted = generateCommitsFetcher.data && !('error' in generateCommitsFetcher.data);

  const handleGenerateCommits = React.useCallback(() => {
    if (commitGenerationCompleted) {
      window.main.trackSegmentEvent({ event: SegmentEvent.recommendCommitsCancelled });
      setCommitGenerationKey(commitGenerationKey + 1);
      return;
    }

    window.main.trackSegmentEvent({ event: SegmentEvent.recommendCommitsClicked });
    generateCommitsFetcher.submit({
      projectId,
    });
  }, [commitGenerationKey, generateCommitsFetcher, projectId, commitGenerationCompleted]);

  return (
    <>
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
                  <Heading slot="title" className="flex items-center gap-2 text-2xl">
                    {mode === StagingModalModes.commitAndPull ? 'Uncommitted changes' : 'Commit Changes'}{' '}
                    {gitChangesFetcher.state === 'loading' && <Icon icon="spinner" className="animate-spin" />}
                  </Heading>

                  <Button
                    className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={close}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                {mode === StagingModalModes.commitAndPull && (
                  <div className="'text-(--color-font-warning) flex flex-wrap items-center justify-between gap-2 rounded-sm border border-solid border-(--hl-md) bg-[rgba(var(--color-warning-rgb),0.5)] p-(--padding-sm)">
                    <p className="text-base">
                      <Icon icon="exclamation-triangle" className="mr-2" />
                      You have uncommitted changes. Commit or discard them to proceed with pull.
                    </p>
                  </div>
                )}
                <div className="grid h-full grid-cols-[300px_1fr] gap-2 divide-x divide-solid divide-(--hl-md) overflow-hidden">
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden p-2">
                    {isGenerateCommitMessagesWithAIEnabled && (
                      <div className="flex flex-col gap-3 rounded-sm border border-solid border-(--hl-md) p-3">
                        <h3 className="font-semibold">
                          <Badge icon="sparkles" color="surprise" label="AI" />
                          Smart commits
                        </h3>
                        <div className="text-sm text-gray-300">
                          {generateCommitsFetcher?.data?.commits
                            ? `${generateCommitsFetcher?.data?.commits.length} commit${generateCommitsFetcher?.data?.commits.length !== 1 ? 's' : ''} generated`
                            : 'Let AI create commits and comments from your staged changes.'}
                        </div>
                        <Button
                          isDisabled={isGeneratingCommits}
                          className="flex h-8 items-center gap-2 self-start rounded-md border border-solid border-(--hl-md) px-3 py-1 text-sm"
                          onPress={handleGenerateCommits}
                        >
                          {commitGenerationCompleted ? (
                            <Icon icon="chevron-left" className="size-3" />
                          ) : (
                            isGeneratingCommits && <Icon icon="spinner" className="animate-spin" />
                          )}
                          {commitGenerationCompleted
                            ? 'Back to manual commits'
                            : isGeneratingCommits
                              ? 'Generating commits...'
                              : 'Generate Commits'}
                        </Button>
                      </div>
                    )}
                    {!isGenerateCommitMessagesWithAIEnabled && (
                      <div className="flex flex-col gap-3 rounded-sm border border-solid border-(--hl-md) p-3">
                        <h3 className="font-semibold">
                          <Badge icon="sparkles" color="surprise" label="AI" />
                          Smart commits
                        </h3>
                        <div className="text-sm text-gray-300">
                          Let AI create commits and comments from your staged changes.
                        </div>
                        <Button
                          className="flex h-8 items-center gap-2 self-start rounded-md border border-solid border-(--hl-md) px-3 py-1 text-sm"
                          onPress={() => {
                            onClose();
                            showSettingsModal({ tab: 'ai' });
                          }}
                        >
                          Enable AI to Try
                        </Button>
                      </div>
                    )}
                    {isGenerateCommitMessagesWithAIEnabled &&
                      generateCommitsFetcher.state === 'idle' &&
                      generateCommitsFetcher.data &&
                      'error' in generateCommitsFetcher.data && (
                        <p className="flex items-center gap-2 rounded-xs bg-(--color-danger)/20 p-2 text-sm text-(--color-font-danger)">
                          <Icon icon="exclamation-triangle" className="size-4" />
                          <span>{generateCommitsFetcher.data.error}</span>
                        </p>
                      )}

                    {generateCommitsFetcher.data && !('error' in generateCommitsFetcher.data) && (
                      <GeneratedCommitsForm
                        commits={generateCommitsFetcher.data.commits}
                        projectId={projectId}
                        mode={mode}
                        changes={changes}
                        setShowConfirmDiscardAndPullModal={setShowConfirmDiscardAndPullModal}
                        onCommitSuccess={handleCommitSuccess}
                        diffChanges={diffChanges}
                      />
                    )}

                    {(!generateCommitsFetcher.data ||
                      (generateCommitsFetcher.data && 'error' in generateCommitsFetcher.data)) && (
                      <ManualCommitForm
                        projectId={projectId}
                        mode={mode}
                        changes={changes}
                        setShowConfirmDiscardAndPullModal={setShowConfirmDiscardAndPullModal}
                        onCommitSuccess={handleCommitSuccess}
                        onPullRequired={handlePullRequired}
                        diffChanges={diffChanges}
                        setDiscardData={setDiscardData}
                      />
                    )}
                  </div>
                  {previewDiffItem?.diff ? (
                    <div className="flex h-full flex-col gap-2 overflow-y-auto pb-0">
                      <Heading className="flex items-center gap-2 font-bold">
                        <Icon icon="code-compare" />
                        {previewDiffItem.name}
                      </Heading>
                      {previewDiffItem && (
                        <div className="flex-1 overflow-hidden rounded-xs bg-(--hl-xs) p-2 text-(--color-font)">
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
      className="fixed top-[50%] left-0 z-10 flex h-(--visual-viewport-height) w-full translate-y-[-50%] items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose?.();
        }}
        className="flex w-full max-w-2xl flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden data-loading:animate-pulse">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="flex items-center gap-2 text-2xl">
                  Discard Changes
                </Heading>

                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="">{message}</div>
              <div className="flex h-10 shrink-0 items-center justify-end gap-2">
                <Button
                  className="h-full gap-2 rounded-md bg-(--color-bg) px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all hover:bg-(--hl-xs)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) aria-pressed:opacity-80"
                  onPress={() => close?.()}
                >
                  Cancel
                </Button>
                <Button
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
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
