import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import {
  Button,
  Dialog,
  Form,
  GridList,
  GridListItem,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from 'react-aria-components';
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
  handleClose?: () => void;
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

  useImperativeHandle(
    ref,
    () => ({
      hide: reset,
      show: ({ conflicts, labels, handleDone, handleClose }) => {
        setState({
          conflicts,
          handleDone,
          handleClose,
          isOpen: true,
          labels,
        });
        // select the first conflict by default
        setSelectedConflict(conflicts?.[0] || null);

        window.main.trackSegmentEvent({
          event: SegmentEvent.syncConflictResolutionStart,
        });
      },
    }),
    [reset],
  );

  const { conflicts, handleDone, handleClose } = state;

  const [selectedConflict, setSelectedConflict] = useState<MergeConflict | null>(null);

  const selectedConflictDiff = selectedConflict ? getDiffFromConflict(selectedConflict) : null;

  return (
    <ModalOverlay
      isOpen={state.isOpen}
      onOpenChange={isOpen => {
        !isOpen && reset();

        !isOpen && handleDone?.();
        !isOpen && handleClose?.();
      }}
      isDismissable
      className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && reset();

          !isOpen && handleDone?.();
          !isOpen && handleClose?.();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] max-h-full w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-none">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex flex-shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Resolve conflicts
                </Heading>
                <Button
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <Form
                className="flex flex-1 flex-col gap-4 overflow-hidden"
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
                <div className="grid h-full gap-2 divide-x divide-solid divide-[--hl-md] overflow-hidden [grid-template-columns:300px_1fr]">
                  {conflicts && conflicts.length > 0 && (
                    <div className="flex flex-col gap-2 overflow-hidden">
                      <Button
                        type="submit"
                        className="flex h-10 items-center justify-center gap-2 rounded-sm bg-[--hl-xxs] px-4 text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      >
                        <Icon icon="code-merge" className="w-5" /> Resolve conflicts
                      </Button>
                      <div className="w-full flex-1 select-none overflow-y-auto">
                        <GridList
                          aria-label="Conflicted changes"
                          selectedKeys={[selectedConflict?.key || '']}
                          selectionMode="single"
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
                            <GridListItem className="group flex w-full select-none items-center justify-between overflow-hidden px-2 py-1 text-[--hl] outline-none transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] aria-selected:bg-[--hl-sm] aria-selected:text-[--color-font]">
                              <span className="truncate">{item.name}</span>
                              <RadioGroup
                                onChange={value => {
                                  setState({
                                    ...state,
                                    conflicts: conflicts.map(c =>
                                      c.key !== item.key ? c : { ...c, choose: value || null },
                                    ),
                                  });
                                }}
                                aria-label="Choose version"
                                name="type"
                                value={item.choose || ''}
                                className="flex flex-col gap-2 text-sm"
                              >
                                <div className="flex gap-2">
                                  <Radio
                                    value={item.mineBlob || ''}
                                    className="flex flex-1 items-center gap-2 rounded border border-solid border-[--hl-md] px-2 py-1 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:text-[--color-font] data-[selected]:ring-[--color-surprise]"
                                  >
                                    <Icon icon="laptop" />
                                    <span>Ours</span>
                                  </Radio>
                                  <Radio
                                    value={item.theirsBlob || ''}
                                    className="flex flex-1 items-center gap-2 rounded border border-solid border-[--hl-md] px-2 py-1 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:text-[--color-font-surprise] data-[selected]:ring-[--color-surprise]"
                                  >
                                    <Icon icon="globe" />
                                    <span>Theirs</span>
                                  </Radio>
                                </div>
                              </RadioGroup>
                            </GridListItem>
                          )}
                        </GridList>
                      </div>
                    </div>
                  )}

                  {selectedConflict ? (
                    <div className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-0">
                      <Heading className="flex items-center gap-2 font-bold">
                        <Icon icon="code-compare" />
                        {selectedConflict.name}
                      </Heading>
                      <div className="flex w-full items-center gap-2">
                        <span className="flex flex-1 items-center gap-2 bg-[--hl-xs] p-2 text-xs font-semibold uppercase text-[--hl]">
                          <Icon icon="laptop" /> {state.labels.ours}
                        </span>
                        <span className="flex flex-1 items-center gap-2 bg-[--hl-xs] p-2 text-xs font-semibold uppercase text-[--hl]">
                          <Icon icon="globe" /> {state.labels.theirs}
                        </span>
                      </div>
                      <div className="flex-1 overflow-y-auto rounded-sm bg-[--hl-xs] p-2 text-[--color-font]">
                        <DiffEditor
                          original={selectedConflictDiff?.before || ''}
                          modified={selectedConflictDiff?.after || ''}
                        />
                      </div>
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
              </Form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
});

SyncMergeModal.displayName = 'SyncMergeModal';
