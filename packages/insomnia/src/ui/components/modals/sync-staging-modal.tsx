import 'json-diff-kit/dist/viewer.css';

import { Viewer } from 'json-diff-kit';
import React, { useEffect, useState } from 'react';
import { Button, Dialog, GridList, GridListItem, Heading, Label, Modal, ModalOverlay, TextArea, TextField } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { all } from '../../../models';
import type { StageEntry, Status, StatusCandidate } from '../../../sync/types';
import { Icon } from '../icon';

interface Props {
  branch: string;
  status: Status;
  syncItems: StatusCandidate[];
  onClose: () => void;
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
  }));;
  const unstagedChanges = Object.entries(status.unstaged).map(([key, entry]) => ({
    ...entry,
    document: syncItems.find(item => item.key === key)?.document || 'deleted' in entry ? { type: getModelTypeById(key) } : undefined,
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

  const [previewDiffItem, setPreviewDiffItem] = useState<StageEntry | null>(null);

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
                <Heading slot="title" className='text-2xl'>Create commit</Heading>
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
                      Commit message
                    </Label>
                    <TextArea
                      rows={3}
                      name="message"
                      className="border border-solid border-[--hl-sm] rounded-sm p-2 resize-none"
                      placeholder="This is a helpful message that describes the changes made in this snapshot"
                      required
                    />
                  </TextField>
                  {data?.error && (
                    <p className="notice flex-shrink-0 error margin-top-sm">
                      {data.error}
                    </p>
                  )}

                  <div className="flex flex-shrink-0 justify-stretch gap-2 items-center">
                    <Button
                      type='submit'
                      isDisabled={state !== 'idle'}
                      formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot`}
                      className="hover:no-underline flex-1 flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      <Icon icon={isCreatingSnapshot ? 'spinner' : 'check'} className={`w-5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} /> Commit
                    </Button>
                    <Button
                      type="submit"
                      isDisabled={state !== 'idle'}
                      formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot-and-push`}
                      className="hover:no-underline flex-1 flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      <Icon icon={isPushing ? 'spinner' : 'cloud-arrow-up'} className={`w-5 ${isPushing ? 'animate-spin' : ''}`} /> Commit and push
                    </Button>
                  </div>
                  </Form>

                  <div className='grid auto-rows-auto gap-2 overflow-y-auto'>
                    {stagedChanges.length > 0 && <div className='flex flex-col gap-2 overflow-hidden max-h-96 w-full'>
                      <Heading className='group font-semibold flex-shrink-0 w-full flex items-center py-1 justify-between'>
                        <span>Staged changes</span>
                        <Button
                          className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                          slot={null}
                          onPress={() => {
                            unstageChanges(stagedChanges.map(item => item.key));
                          }}
                        >
                          <Icon icon="minus" />
                        </Button>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={stagedChanges.map(item => ({
                            ...item,
                            id: item.key,
                            textValue: item.name || item.document?.type || '',
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            const item = allChanges.find(item => item.key === key);
                            item && setPreviewDiffItem(item);
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group outline-none select-none hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                                <span className='truncate'>{item.name || item.document?.type}</span>
                                <div className='flex items-center gap-1'>
                                  <Button
                                    className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                                    slot={null}
                                    onPress={() => {
                                      unstageChanges([item.key]);
                                    }}
                                  >
                                    <Icon icon="minus" />
                                  </Button>
                                </div>
                              </GridListItem>
                            );
                          }}
                        </GridList>
                      </div>
                    </div>}
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96 w-full'>
                      <Heading className='group font-semibold flex-shrink-0 w-full flex items-center py-1 justify-between'>
                        <span>Changes</span>
                        <div className='flex items-center gap-1'>
                          <Button
                            className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                            slot={null}
                            onPress={console.log}
                          >
                            <Icon icon="undo" />
                          </Button>
                          <Button
                            className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                            slot={null}
                            onPress={() => {
                              stageChanges(unstagedChanges.map(item => item.key));
                            }}
                          >
                            <Icon icon="plus" />
                          </Button>
                        </div>
                      </Heading>
                      <div className='flex-1 flex overflow-y-auto w-full select-none'>
                        <GridList
                          className="w-full"
                          items={unstagedChanges.map(item => ({
                            ...item,
                            id: item.key,
                            textValue: item.name || item.document?.type || '',
                          }))}
                          aria-label='Unstaged changes'
                          onAction={key => {
                            const item = allChanges.find(item => item.key === key);
                            item && setPreviewDiffItem(item);
                          }}
                        >
                          {item => {
                            return (
                              <GridListItem className="group outline-none select-none hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                                <span className='truncate'>{item.name || item.document?.type}</span>
                                <div className='flex items-center gap-1'>
                                  <Button
                                    className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                                    slot={null}
                                    onPress={console.log}
                                  >
                                    <Icon icon="undo" />
                                  </Button>
                                  <Button
                                    className='opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm'
                                    slot={null}
                                    onPress={() => {
                                      stageChanges([item.key]);
                                    }}
                                  ><Icon icon="plus" /></Button>
                                </div>
                              </GridListItem>
                            );
                          }}
                        </GridList>
                      </div>
                    </div>
                  </div>
                </div>
                {previewDiffItem ? <div className='p-2 flex flex-col gap-2 h-full overflow-y-auto'>
                  <Heading className='font-bold flex items-center gap-2'>
                    <Icon icon="code-compare" />
                    {previewDiffItem.name || ('document' in previewDiffItem && previewDiffItem.document && 'type' in previewDiffItem.document ? previewDiffItem.document?.type : '')}
                  </Heading>
                  {previewDiffItem && 'diff' in previewDiffItem && previewDiffItem.diff && (
                    <div
                      className='bg-[--hl-xs] p-2 flex-1 overflow-y-auto text-[--color-font]'
                    >
                      <Viewer
                        diff={previewDiffItem.diff}
                        hideUnchangedLines
                        className='diff-viewer'
                      />
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
