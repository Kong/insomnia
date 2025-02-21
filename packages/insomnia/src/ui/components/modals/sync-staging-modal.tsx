import React, { useEffect, useState } from 'react';
import { Button, Dialog, GridList, GridListItem, Heading, Label, Modal, ModalOverlay, TextArea, TextField, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';
import { stringify } from 'yaml';

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
    if (previewDiffItem.previousBlobContent === 'null') {
      before = '';
    } else {
      before = previewDiffItem.previousBlobContent || '{}';
    }
  }

  if (previewDiffItem && 'blobContent' in previewDiffItem && previewDiffItem.blobContent) {
    if (previewDiffItem.blobContent === 'null') {
      after = '';
    } else {
      after = previewDiffItem.blobContent || '{}';
    }
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
    document: syncItems.find(item => item.key === key)?.document || 'deleted' in entry ? { type: getModelTypeById(key) } : undefined,
    id: `staged-${key}`,
  }));;
  const unstagedChanges = Object.entries(status.unstaged).map(([key, entry]) => ({
    ...entry,
    document: syncItems.find(item => item.key === key)?.document || 'deleted' in entry ? { type: getModelTypeById(key) } : undefined,
    id: `unstaged-${key}`,
  }));;

  const stageChangesFetcher = useFetcher();

  const stageChanges = (keys: string[]) => {
    stageChangesFetcher.submit({
      keys,
    }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/stage`,
      method: 'POST',
      encType: 'application/json',
    });
  };

  const unstageChanges = (keys: string[]) => {
    stageChangesFetcher.submit({
      keys,
    }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/unstage`,
      method: 'POST',
      encType: 'application/json',
    });
  };

  const allChanges = [...stagedChanges, ...unstagedChanges];
  const allChangesLength = allChanges.length;
  const { Form, formAction, state, data } = useFetcher();
  const error = data?.error;

  const isPushing = state !== 'idle' && formAction?.endsWith('create-snapshot-and-push');
  const isCreatingSnapshot = state !== 'idle' && formAction?.endsWith('create-snapshot');

  useEffect(() => {
    if (allChangesLength === 0 && !error) {
      onClose();
    }
  }, [allChangesLength, onClose, error]);

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
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col w-[calc(100%-var(--padding-xl))] h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
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
                        isDisabled={state !== 'idle'}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot`}
                        className="flex-1 flex h-8 items-center justify-center px-4 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      >
                        <Icon icon={isCreatingSnapshot ? 'spinner' : 'check'} className={`w-5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} /> Commit
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={state !== 'idle'}
                        formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot-and-push`}
                        className="flex-1 flex h-8 items-center justify-center px-4 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      >
                        <Icon icon={isPushing ? 'spinner' : 'cloud-arrow-up'} className={`w-5 ${isPushing ? 'animate-spin' : ''}`} /> Commit and push
                      </Button>
                    </div>
                    {data?.error && (
                      <p className="bg-opacity-20 text-sm text-[--color-font-danger] p-2 rounded-sm bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))]">
                        <Icon icon="exclamation-triangle" /> {data.error}
                      </p>
                    )}
                  </Form>

                  <div className='grid auto-rows-auto gap-2 overflow-y-auto'>
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96 w-full'>
                      <Heading className='group font-semibold flex-shrink-0 w-full flex items-center gap-2 py-1 justify-between'>
                        <span className='flex-1'>Staged changes</span>
                        <Button
                          className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                          slot={null}
                          onPress={() => {
                            unstageChanges(stagedChanges.map(item => item.key));
                          }}
                        >
                          <Icon icon="minus" />
                        </Button>
                        <span className='text-xs rounded-full px-1 text-[--hl] bg-[--hl-sm]'>{stagedChanges.length}</span>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={stagedChanges.map(entry => ({
                            entry,
                            id: entry.id,
                            key: entry.id,
                            textValue: entry.name || entry.document?.type || '',
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            setSelectedItemId(key.toString());
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
                                <span className='truncate'>{item.entry.name || item.entry.document?.type}</span>
                                <div className='flex items-center gap-1'>
                                  <Button
                                    className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
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
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                    >
                                      {'added' in item.entry ? 'Untracked' : 'deleted' in item.entry ? 'Deleted' : 'Modified'}
                                    </Tooltip>
                                  </TooltipTrigger>
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
                          <Button
                            className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                            slot={null}
                            onPress={() => {
                              stageChanges(unstagedChanges.map(item => item.key));
                            }}
                          >
                            <Icon icon="plus" />
                          </Button>
                          <span className='text-xs rounded-full px-1 text-[--hl] bg-[--hl-sm]'>{unstagedChanges.length}</span>
                        </div>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={unstagedChanges.map(entry => ({
                            entry,
                            id: entry.id,
                            key: entry.id,
                            textValue: entry.name || entry.document?.type || '',
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            setSelectedItemId(key.toString());
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group outline-none select-none aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                                <span className='truncate'>{item.entry.name || item.entry.document?.type}</span>
                                <div className='flex items-center gap-1'>
                                  <Button
                                    className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus-within:opacity-100 group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
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
                                      className="border select-none text-sm max-w-xs border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
                                    >
                                      {'added' in item.entry ? 'Untracked' : 'deleted' in item.entry ? 'Deleted' : 'Modified'}
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
                {previewDiffItem ? <div className='p-2 pb-0 flex flex-col gap-2 h-full overflow-y-auto'>
                  <Heading className='font-bold flex items-center gap-2'>
                    <Icon icon="code-compare" />
                    {previewDiffItemName}
                  </Heading>
                  {previewDiffItem && (
                    <div
                      className='bg-[--hl-xs] rounded-sm p-2 flex-1 overflow-y-auto text-[--color-font]'
                    >
                      <DiffEditor original={diff.before} modified={diff.after} />
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
