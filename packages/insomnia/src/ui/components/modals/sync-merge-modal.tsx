import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { Button, Dialog, Form, GridList, GridListItem, Heading, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { stringify } from 'yaml';

import type { MergeConflict } from '../../../sync/types';
import { SegmentEvent } from '../../analytics';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';

function getDiffFromConflict(conflict: MergeConflict) {
  let before = '';
  let after = '';

  if (conflict.mineBlobContent) {
    try {
      before = stringify(conflict.mineBlobContent);
    } catch (error) {
      console.warn('Failed to stringify mineBlobContent', error);
    }
  }

  if (conflict.theirsBlobContent) {
    try {
      after = stringify(conflict.theirsBlobContent);
    } catch (error) {
      console.warn('Failed to stringify theirsBlobContent', error);
    }
  }

  return {
    before,
    after,
  };
}

export interface SyncMergeModalOptions {
  conflicts?: MergeConflict[];
  labels: { ours: string; theirs: string };
  handleDone?: (conflicts?: MergeConflict[]) => void;
}
export interface SyncMergeModalHandle {
  show: (options: SyncMergeModalOptions) => void;
  hide: () => void;
}
export const SyncMergeModal = forwardRef<SyncMergeModalHandle>((_, ref) => {
  const [state, setState] = useState<SyncMergeModalOptions & { isOpen: boolean }>({
    conflicts: [],
    isOpen: false,
    labels: { ours: '', theirs: '' },
  });

  const reset = useCallback(() => {
    setState({
      conflicts: [],
      isOpen: false,
      labels: { ours: '', theirs: '' },
    });
    setSelectedConflict(null);
  }, []);

  useImperativeHandle(ref, () => ({
    hide: reset,
    show: ({ conflicts, labels, handleDone }) => {
      setState({
        conflicts,
        handleDone,
        isOpen: true,
        labels,
      });
      // select the first conflict by default
      setSelectedConflict(conflicts?.[0] || null);

      window.main.trackSegmentEvent({
        event: SegmentEvent.syncConflictResolutionStart,
      });
    },
  }), [reset]);

  const { conflicts, handleDone } = state;

  const [selectedConflict, setSelectedConflict] = useState<MergeConflict | null>(null);

  const selectedConflictDiff = selectedConflict ? getDiffFromConflict(selectedConflict) : null;

  return (
    <ModalOverlay
      isOpen={state.isOpen}
      onOpenChange={isOpen => {
        !isOpen && reset();

        !isOpen && handleDone?.();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && reset();

          !isOpen && handleDone?.();
        }}
        className="flex flex-col w-[calc(100%-var(--padding-xl))] h-[calc(100%-var(--padding-xl))] rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex-shrink-0 flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>Resolve conflicts</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <Form
                className='flex-1 flex flex-col gap-4 overflow-hidden'
                onSubmit={event => {
                  event.preventDefault();
                  handleDone?.(conflicts);
                  // if at least one conflict.choose is theirsBlob, track conflict resolution complete as theirs
                  if (conflicts?.some(conflict => conflict.choose === conflict.theirsBlob)) {
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.syncConflictResolutionCompleteTheirs,
                    });
                  }
                  // if at least one conflict.choose is mine, track conflict resolution complete as mine
                  if (conflicts?.some(conflict => conflict.choose === conflict.mineBlob)) {
                    window.main.trackSegmentEvent({
                      event: SegmentEvent.syncConflictResolutionCompleteMine,
                    });
                  }

                  reset();
                }}
              >
                <div className='grid [grid-template-columns:300px_1fr] h-full overflow-hidden divide-x divide-solid divide-[--hl-md] gap-2'>
                  {conflicts && conflicts.length > 0 && (
                    <div className='flex flex-col gap-2 overflow-hidden'>
                      <Button
                        type="submit"
                        className="flex h-10 items-center justify-center px-4 gap-2 bg-[--hl-xxs] aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
                      >
                        <Icon icon="code-merge" className="w-5" /> Resolve conflicts
                      </Button>
                      <div className='flex-1 overflow-y-auto w-full select-none'>
                        <GridList
                          aria-label='Conflicted changes'
                          selectedKeys={[selectedConflict?.key || '']}
                          selectionMode='single'
                          onSelectionChange={keys => {
                            if (keys !== 'all') {
                              const selectedKey = keys.values().next().value;

                              setSelectedConflict(conflicts.find(c => c.key === selectedKey) || null);
                            }
                          }}
                          items={conflicts.map(conflict => ({
                            id: conflict.key,
                            ...conflict,
                          }))}
                        >
                          {item => (
                            <GridListItem className="group outline-none select-none aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font] hover:bg-[--hl-xs] focus:bg-[--hl-sm] overflow-hidden text-[--hl] transition-colors w-full flex items-center px-2 py-1 justify-between">
                              <span className='truncate'>{item.name}</span>
                              <RadioGroup
                                onChange={value => {
                                  setState({
                                    ...state,
                                    conflicts: conflicts.map(c => c.key !== item.key ? c : { ...c, choose: value || null }),
                                  });
                                }}
                                aria-label='Choose version'
                                name="type"
                                value={item.choose || ''}
                                className="flex flex-col gap-2 text-sm"
                              >
                                <div className="flex gap-2">
                                  <Radio
                                    value={item.mineBlob || ''}
                                    className="flex items-center gap-2 data-[selected]:text-[--color-font] data-[selected]:border-[--color-surprise] flex-1 data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded px-2 py-1 focus:outline-none transition-colors"
                                  >
                                    <Icon icon="laptop" />
                                    <span>
                                      Ours
                                    </span>
                                  </Radio>
                                  <Radio
                                    value={item.theirsBlob || ''}
                                    className="flex items-center gap-2 data-[selected]:text-[--color-font-surprise] data-[selected]:border-[--color-surprise] flex-1 data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded px-2 py-1 focus:outline-none transition-colors"
                                  >
                                    <Icon icon="globe" />
                                    <span>
                                      Theirs
                                    </span>
                                  </Radio>
                                </div>
                              </RadioGroup>
                            </GridListItem>
                          )}
                        </GridList>
                      </div>
                    </div>
                  )}

                  {selectedConflict ? <div className='p-2 pb-0 flex flex-col gap-2 h-full overflow-y-auto'>
                    <Heading className='font-bold flex items-center gap-2'>
                      <Icon icon="code-compare" />
                      {selectedConflict.name}
                    </Heading>
                    <div className='flex w-full items-center gap-2'>
                      <span className='flex-1 flex items-center gap-2 p-2 bg-[--hl-xs] uppercase font-semibold text-xs text-[--hl]'><Icon icon="laptop" /> {state.labels.ours}</span>
                      <span className='flex-1 flex items-center gap-2 p-2 bg-[--hl-xs] uppercase font-semibold text-xs text-[--hl]'><Icon icon="globe" /> {state.labels.theirs}</span>
                    </div>
                    <div
                      className='bg-[--hl-xs] rounded-sm p-2 flex-1 overflow-y-auto text-[--color-font]'
                    >
                      <DiffEditor original={selectedConflictDiff?.before || ''} modified={selectedConflictDiff?.after || ''} />
                    </div>
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
              </Form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});

SyncMergeModal.displayName = 'SyncMergeModal';
