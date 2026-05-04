import { useEffect, useState } from 'react';
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
import { stringify } from 'yaml';

import { useInsomniaSyncCreateSnapshotActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.create-snapshot';
import { useInsomniaSyncStageActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.stage';
import { useInsomniaSyncUnstageActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.unstage';

import { all } from '../../../models';
import type { StageEntry, Status, StatusCandidate } from '../../../sync/types';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';

interface Props {
  branch: string;
  status: Status;
  syncItems: StatusCandidate[];
  onClose: () => void;
}

function getDiff(previewDiffItem?: StageEntry) {
  let before = '{}';
  let after = '{}';

  if (previewDiffItem && 'previousBlobContent' in previewDiffItem && previewDiffItem.previousBlobContent) {
    before = previewDiffItem.previousBlobContent === 'null' ? '' : previewDiffItem.previousBlobContent || '{}';
  }

  if (previewDiffItem && 'blobContent' in previewDiffItem && previewDiffItem.blobContent) {
    after = previewDiffItem.blobContent === 'null' ? '' : previewDiffItem.blobContent || '{}';
  }

  try {
    before = stringify(JSON.parse(before));
  } catch (e) {
    console.warn('Failed to parse before JSON', e);
  }

  try {
    after = stringify(JSON.parse(after));
  } catch (e) {
    console.warn('Failed to parse after JSON', e);
  }

  return {
    before,
    after,
  };
}

function getPreviewItemName(previewDiffItem?: StageEntry & { document?: { type: string } }) {
  if (!previewDiffItem) {
    return 'Diff view';
  }

  if ('name' in previewDiffItem && previewDiffItem.name) {
    return previewDiffItem.name;
  }

  if ('document' in previewDiffItem && previewDiffItem.document && 'type' in previewDiffItem.document) {
    return previewDiffItem.document?.type;
  }

  return 'Diff view';
}

function getModelTypeById(id: string) {
  const idPrefix = id.split('_')[0];
  const model = all().find(model => model.prefix === idPrefix);

  return model?.name || 'Unknown';
}

export const SyncStagingModal = ({ onClose, status, syncItems }: Props) => {
  const { projectId, workspaceId, organizationId } = useParams() as {
    projectId: string;
    workspaceId: string;
    organizationId: string;
  };

  const stagedChanges = Object.entries(status.stage).map(([key, entry]) => ({
    ...entry,
    document:
      syncItems.find(item => item.key === key)?.document || 'deleted' in entry
        ? { type: getModelTypeById(key) }
        : undefined,
    id: `staged-${key}`,
  }));
  const unstagedChanges = Object.entries(status.unstaged).map(([key, entry]) => ({
    ...entry,
    document:
      syncItems.find(item => item.key === key)?.document || 'deleted' in entry
        ? { type: getModelTypeById(key) }
        : undefined,
    id: `unstaged-${key}`,
  }));

  const stageChangesFetcher = useInsomniaSyncStageActionFetcher();
  const unstageChangesFetcher = useInsomniaSyncUnstageActionFetcher();

  const stageChanges = (keys: string[]) => {
    stageChangesFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      keys,
    });
  };

  const unstageChanges = (keys: string[]) => {
    unstageChangesFetcher.submit({
      keys,
      organizationId,
      projectId,
      workspaceId,
    });
  };

  const allChanges = [...stagedChanges, ...unstagedChanges];
  const allChangesLength = allChanges.length;

  const createSnapshotFetcher = useInsomniaSyncCreateSnapshotActionFetcher();

  useEffect(() => {
    if (allChangesLength === 0 && !createSnapshotFetcher.data?.error) {
      onClose();
    }
  }, [allChangesLength, onClose, createSnapshotFetcher.data?.error]);

  const [selectedItemId, setSelectedItemId] = useState<string>('');

  const previewDiffItem = allChanges.find(item => item.id === selectedItemId);
  const previewDiffItemName = getPreviewItemName(previewDiffItem);
  const diff = getDiff(previewDiffItem);

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
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
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
              <div className="grid h-full grid-cols-[350px_1fr] gap-4 divide-x divide-solid divide-(--hl-md) overflow-hidden">
                <div className="flex flex-1 flex-col gap-4 overflow-hidden p-2">
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      const submitter = e.nativeEvent instanceof SubmitEvent ? e.nativeEvent.submitter : null;
                      const formData = new FormData(e.currentTarget, submitter);
                      const message = formData.get('message')?.toString().trim() || '';
                      const push = Boolean(formData.get('push') === 'true');
                      if (message) {
                        createSnapshotFetcher.submit({
                          organizationId,
                          projectId,
                          workspaceId,
                          message,
                          push,
                        });
                      }
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
                        isDisabled={createSnapshotFetcher.state !== 'idle'}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot`}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon
                          icon={createSnapshotFetcher.state !== 'idle' ? 'spinner' : 'check'}
                          className={`w-5 ${createSnapshotFetcher.state === 'idle' ? '' : 'animate-spin'}`}
                        />{' '}
                        Commit
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={createSnapshotFetcher.state !== 'idle'}
                        name="push"
                        value="true"
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon
                          icon={createSnapshotFetcher.state !== 'idle' ? 'spinner' : 'cloud-arrow-up'}
                          className={`w-5 ${createSnapshotFetcher.state !== 'idle' ? 'animate-spin' : ''}`}
                        />{' '}
                        Commit and push
                      </Button>
                    </div>
                    {createSnapshotFetcher.data?.error && (
                      <p className="rounded-xs bg-(--color-danger)/20 p-2 text-sm text-(--color-font-danger)">
                        <Icon icon="exclamation-triangle" /> {createSnapshotFetcher.data.error}
                      </p>
                    )}
                  </form>

                  <div className="grid auto-rows-auto gap-2 overflow-y-auto">
                    <div className="flex max-h-96 w-full flex-col gap-2 overflow-hidden">
                      <Heading className="group flex w-full shrink-0 items-center justify-between gap-2 py-1 font-semibold">
                        <span className="flex-1">Staged changes</span>
                        <Button
                          className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                          slot={null}
                          onPress={() => {
                            unstageChanges(stagedChanges.map(item => item.key));
                          }}
                        >
                          <Icon icon="minus" />
                        </Button>
                        <span className="rounded-full bg-(--hl-sm) px-1 text-xs text-(--hl)">
                          {stagedChanges.length}
                        </span>
                      </Heading>
                      <div className="flex w-full flex-1 overflow-y-auto select-none">
                        <GridList
                          className="w-full"
                          items={stagedChanges.map(entry => ({
                            entry,
                            id: entry.id,
                            key: entry.id,
                            textValue: entry.name || entry.document?.type || '',
                          }))}
                          aria-label="Unstaged changes"
                          onAction={key => {
                            setSelectedItemId(key.toString());
                          }}
                          renderEmptyState={() => (
                            <p className="p-2 text-sm text-(--hl)">Stage your changes to commit them.</p>
                          )}
                        >
                          {item => {
                            return (
                              <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                <span className="truncate">{item.entry.name || item.entry.document?.type}</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                                    slot={null}
                                    onPress={() => {
                                      unstageChanges([item.entry.key]);
                                    }}
                                  >
                                    <Icon icon="minus" />
                                  </Button>
                                  <TooltipTrigger>
                                    <Button className="cursor-default">
                                      {'added' in item.entry ? 'U' : 'deleted' in item.entry ? 'D' : 'M'}
                                    </Button>
                                    <Tooltip
                                      offset={8}
                                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                                    >
                                      {'added' in item.entry
                                        ? 'Untracked'
                                        : 'deleted' in item.entry
                                          ? 'Deleted'
                                          : 'Modified'}
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
                          <Button
                            className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                            slot={null}
                            onPress={() => {
                              stageChanges(unstagedChanges.map(item => item.key));
                            }}
                          >
                            <Icon icon="plus" />
                          </Button>
                          <span className="rounded-full bg-(--hl-sm) px-1 text-xs text-(--hl)">
                            {unstagedChanges.length}
                          </span>
                        </div>
                      </Heading>
                      <div className="flex w-full flex-1 overflow-y-auto select-none">
                        <GridList
                          className="w-full"
                          items={unstagedChanges.map(entry => ({
                            entry,
                            id: entry.id,
                            key: entry.id,
                            textValue: entry.name || entry.document?.type || '',
                          }))}
                          aria-label="Unstaged changes"
                          onAction={key => {
                            setSelectedItemId(key.toString());
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                <span className="truncate">{item.entry.name || item.entry.document?.type}</span>
                                <div className="flex items-center gap-1">
                                  <Button
                                    className="flex aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-focus-within:opacity-100 group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                                    slot={null}
                                    onPress={() => {
                                      stageChanges([item.entry.key]);
                                    }}
                                  >
                                    <Icon icon="plus" />
                                  </Button>
                                  <TooltipTrigger>
                                    <Button className="cursor-default">
                                      {'added' in item.entry ? 'U' : 'deleted' in item.entry ? 'D' : 'M'}
                                    </Button>
                                    <Tooltip
                                      offset={8}
                                      className="max-h-[85vh] max-w-xs overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-4 py-2 text-sm text-(--color-font) shadow-lg select-none focus:outline-hidden"
                                    >
                                      {'added' in item.entry
                                        ? 'Untracked'
                                        : 'deleted' in item.entry
                                          ? 'Deleted'
                                          : 'Modified'}
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
                {previewDiffItem ? (
                  <div className="flex h-full flex-col gap-2 overflow-y-auto pb-0">
                    <Heading className="flex items-center gap-2 font-bold">
                      <Icon icon="code-compare" />
                      {previewDiffItemName}
                    </Heading>
                    {previewDiffItem && (
                      <div className="flex-1 overflow-y-auto rounded-xs bg-(--hl-xs) p-2 text-(--color-font)">
                        <DiffEditor original={diff.before} modified={diff.after} />
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
