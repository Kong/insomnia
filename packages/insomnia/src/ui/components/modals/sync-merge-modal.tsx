import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Cell, Column, Dialog, Form, Heading, Modal, ModalOverlay, Radio, RadioGroup, Row, Table, TableBody, TableHeader } from 'react-aria-components';

import type { MergeConflict } from '../../../sync/types';
import { SegmentEvent } from '../../analytics';
import { Icon } from '../icon';

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

  useImperativeHandle(ref, () => ({
    hide: () => setState({
      conflicts: [],
      isOpen: false,
      labels: { ours: '', theirs: '' },
    }),
    show: ({ conflicts, labels, handleDone }) => {
      setState({
        conflicts,
        handleDone,
        isOpen: true,
        labels,
      });

      window.main.trackSegmentEvent({
        event: SegmentEvent.syncConflictResolutionStart,
      });
    },
  }), []);

  const { conflicts, handleDone } = state;

  return (
    <ModalOverlay
      isOpen={state.isOpen}
      onOpenChange={isOpen => {
        !isOpen && setState({
          conflicts: [],
          isOpen: false,
          labels: { ours: '', theirs: '' },
        });
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && setState({
            conflicts: [],
            isOpen: false,
            labels: { ours: '', theirs: '' },
          });
        }}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
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

                  setState({
                    conflicts: [],
                    isOpen: false,
                    labels: { ours: '', theirs: '' },
                  });
                }}
              >
                <div className='grid auto-rows-auto gap-2 overflow-y-auto'>
                  {conflicts && conflicts.length > 0 && (
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96'>
                      <Heading className='font-semibold flex-shrink-0'>Conflicted Objects</Heading>
                      <div className='flex-1 overflow-y-auto rounded w-full border border-solid border-[--hl-sm] select-none'>
                        <Table
                          selectionMode='multiple'
                          defaultSelectedKeys="all"
                          aria-label='Modified objects'
                          className="border-separate border-spacing-0 w-full"
                        >
                          <TableHeader>
                            <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Name
                            </Column>
                            <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Description
                            </Column>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-right text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Resolve
                            </Column>
                          </TableHeader>
                          <TableBody
                            className="divide divide-[--hl-sm] divide-solid"
                            items={
                              conflicts.map(item => ({
                                ...item,
                                id: item.key,
                              }))
                            }
                          >
                            {item => (
                              <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    {item.name}
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    {item.message}
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='flex items-center gap-2 justify-end p-2'>
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
                                      className="flex flex-col gap-2"
                                    >
                                      <div className="flex gap-2">
                                        <Radio
                                          value={item.mineBlob || ''}
                                          className="flex items-center gap-2 data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-1 data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded px-2 py-1 focus:outline-none transition-colors"
                                        >
                                          <Icon icon="laptop" />
                                          <span>
                                            Accept ours ({state.labels.ours})
                                          </span>
                                        </Radio>
                                        <Radio
                                          value={item.theirsBlob || ''}
                                          className="flex items-center gap-2 data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-1 data-[selected]:bg-[rgba(var(--color-surprise-rgb),0.3)] data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded px-2 py-1 focus:outline-none transition-colors"
                                        >
                                          <Icon icon="globe" />
                                          <span>
                                            Accept theirs ({state.labels.theirs})
                                          </span>
                                        </Radio>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                </Cell>
                              </Row>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-shrink-0 flex-1 justify-end gap-2 items-center">
                  <Button
                    type="submit"
                    className="hover:no-underline flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                  >
                    <Icon icon="code-merge" className="w-5" /> Resolve conflicts
                  </Button>
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
