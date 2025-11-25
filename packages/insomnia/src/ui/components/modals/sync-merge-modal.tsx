import classNames from 'classnames';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
} from 'react-aria-components';
import { parse, stringify } from 'yaml';

import { extractErrorMessages } from '~/common/import';
import { InsomniaFileSchema } from '~/common/import-v5-parser';
import { migrateToLatestYaml } from '~/common/insomnia-schema-migrations';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';

import { type MergeConflict, RESOLUTION_SOURCE } from '../../../sync/types';
import { SegmentEvent } from '../../analytics';
import { MergeEditor } from '../.client/codemirror/merge-editor';
import { DiffEditor } from '../diff-view-editor';
import { Icon } from '../icon';

function validateMergeResult(mergeResult: string) {
  // Empty string means the file is deleted
  if (mergeResult === '') {
    return undefined;
  }
  let parsed = null;
  try {
    mergeResult = migrateToLatestYaml(mergeResult);
    parsed = parse(mergeResult);
  } catch (error) {
    return error.message;
  }
  try {
    InsomniaFileSchema.parse(parsed);
  } catch (error) {
    return extractErrorMessages(error).join('\n');
  }
  return undefined;
}

type EditorType = 'diff' | 'merge';

export interface SyncMergeModalOptions {
  editorType?: EditorType;
  conflicts?: MergeConflict[];
  labels: { ours: string; theirs: string };
  onResolveAll: (conflicts: MergeConflict[]) => void;
  onCancelUnresolved?: () => void;
}
export interface SyncMergeModalHandle {
  show: (options: SyncMergeModalOptions) => void;
  hide: () => void;
}
export const SyncMergeModal = forwardRef<SyncMergeModalHandle>((_, ref) => {
  const [conflicts, setConflicts] = useState<MergeConflict[]>([]);
  const [errMsgMapForConflictMergeResult, setErrMsgMapForConflictMergeResult] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [labels, setLabels] = useState<{ ours: string; theirs: string }>({ ours: '', theirs: '' });
  const [editorType, setEditorType] = useState<EditorType>('diff');

  const [selectedConflictKey, setSelectedConflictKey] = useState<string | null>(null);

  const onResolveAllRef = useRef<SyncMergeModalOptions['onResolveAll']>();
  const onCancelUnresolvedRef = useRef<SyncMergeModalOptions['onCancelUnresolved']>();

  const selectedConflict = useMemo(
    () => conflicts.find(c => c.key === selectedConflictKey),
    [conflicts, selectedConflictKey],
  );

  const selectedConflictCurrent = useMemo(() => {
    let current = '';
    if (selectedConflict?.mineBlobContent) {
      try {
        current = stringify(selectedConflict.mineBlobContent);
      } catch (error) {
        console.warn('Failed to stringify mineBlobContent', error);
      }
    }
    return current;
  }, [selectedConflict]);

  const selectedConflictIncoming = useMemo(() => {
    let incoming = '';
    if (selectedConflict?.theirsBlobContent) {
      try {
        incoming = stringify(selectedConflict.theirsBlobContent);
      } catch (error) {
        console.warn('Failed to stringify theirsBlobContent', error);
      }
    }
    return incoming;
  }, [selectedConflict]);

  const reset = useCallback(() => {
    setConflicts([]);
    setIsOpen(false);
    setLabels({ ours: '', theirs: '' });
    setEditorType('diff');
    setSelectedConflictKey(null);
    setErrMsgMapForConflictMergeResult({});
    onResolveAllRef.current = undefined;
    onCancelUnresolvedRef.current = undefined;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      hide: reset,
      show: ({ conflicts, labels, onResolveAll, onCancelUnresolved, editorType = 'diff' }) => {
        setConflicts(
          (conflicts ?? []).map(conflict => ({
            id: conflict.key,
            ...conflict,
          })),
        );
        if (editorType === 'merge' && conflicts) {
          const errMsgMap: Record<string, string> = {};
          conflicts.forEach(conflict => {
            if (conflict.mergeResult) {
              errMsgMap[conflict.key] = validateMergeResult(conflict.mergeResult);
            }
          });
          setErrMsgMapForConflictMergeResult(errMsgMap);
        }
        setLabels(labels);
        setEditorType(editorType);
        setSelectedConflictKey(conflicts?.[0]?.key || null);
        onResolveAllRef.current = onResolveAll;
        onCancelUnresolvedRef.current = onCancelUnresolved;
        setIsOpen(true);

        window.main.trackSegmentEvent({
          event: SegmentEvent.syncConflictResolutionStart,
        });
      },
    }),
    [reset],
  );

  const onMergeEditorResultChange = useCallback(
    (result: string) => {
      if (!conflicts) return;
      if (!selectedConflictKey) return;
      setConflicts(prevConflicts => {
        const updatedConflicts = prevConflicts.map(c => {
          if (c.key === selectedConflictKey) {
            return {
              ...c,
              mergeResult: result,
            };
          }
          return c;
        });
        return updatedConflicts;
      });

      const errMsg = validateMergeResult(result);
      setErrMsgMapForConflictMergeResult(prev => ({
        ...prev,
        [selectedConflictKey]: errMsg,
      }));
    },
    [conflicts, selectedConflictKey],
  );

  return (
    <>
      <ModalOverlay
        isOpen={isOpen}
        onOpenChange={isOpen => {
          !isOpen && onCancelUnresolvedRef.current?.();
          !isOpen && reset();
        }}
        className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
      >
        <Modal className="flex h-[calc(100%-var(--padding-xl))] max-h-full w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
          <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
            {({ close }) => (
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <Heading slot="title" className="text-2xl">
                    Resolve conflicts
                  </Heading>
                </div>
                <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                  <div
                    className={classNames('grid h-full gap-2 divide-x divide-solid divide-(--hl-md) overflow-hidden', {
                      'grid-cols-[300px_1fr]': editorType === 'diff',
                      'grid-cols-[170px_1fr]': editorType === 'merge',
                    })}
                  >
                    {conflicts && conflicts.length > 0 && (
                      <div className="flex flex-col gap-2 overflow-hidden">
                        <Heading className="flex items-center gap-2 font-bold">
                          <Icon icon="code-compare" />
                          Merge changes
                        </Heading>
                        <div className="w-full flex-1 overflow-y-auto select-none">
                          <GridList
                            aria-label="Conflicted changes"
                            selectedKeys={[selectedConflictKey || '']}
                            selectionMode="single"
                            onSelectionChange={keys => {
                              if (keys !== 'all') {
                                const selectedKey = keys.values().next().value;
                                if (typeof selectedKey === 'string') {
                                  setSelectedConflictKey(selectedKey || null);
                                }
                              }
                            }}
                            items={conflicts}
                            dependencies={[selectedConflictKey]}
                          >
                            {item => {
                              if (editorType === 'diff') {
                                return (
                                  <GridListItem className="group flex w-full items-center justify-between overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                    <span className="truncate">{item.name}</span>
                                    <RadioGroup
                                      onChange={value => {
                                        setConflicts(prevConflicts =>
                                          prevConflicts.map(c =>
                                            c.key !== item.key ? c : { ...c, choose: value || null },
                                          ),
                                        );
                                      }}
                                      aria-label="Choose version"
                                      name="type"
                                      value={item.choose || ''}
                                      className="flex flex-col gap-2 text-sm"
                                    >
                                      <div className="flex gap-2">
                                        <Radio
                                          value={item.mineBlob || ''}
                                          className="flex flex-1 items-center gap-2 rounded-sm border border-solid border-(--hl-md) px-2 py-1 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:bg-[rgba(var(--color-surprise-rgb),0.3)] data-selected:text-(--color-font) data-selected:ring-(--color-surprise)"
                                        >
                                          <Icon icon="laptop" />
                                          <span>Current</span>
                                        </Radio>
                                        <Radio
                                          value={item.theirsBlob || ''}
                                          className="flex flex-1 items-center gap-2 rounded-sm border border-solid border-(--hl-md) px-2 py-1 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-selected:border-(--color-surprise) data-selected:bg-[rgba(var(--color-surprise-rgb),0.3)] data-selected:text-(--color-font-surprise) data-selected:ring-(--color-surprise)"
                                        >
                                          <Icon icon="globe" />
                                          <span>Incoming</span>
                                        </Radio>
                                      </div>
                                    </RadioGroup>
                                  </GridListItem>
                                );
                              } else if (editorType === 'merge') {
                                return (
                                  <GridListItem className="relative flex w-full cursor-pointer items-start justify-start gap-2 overflow-hidden px-2 py-1 text-(--hl) outline-hidden transition-colors select-none hover:bg-(--hl-xs) focus:bg-(--hl-sm) aria-selected:bg-(--hl-sm) aria-selected:text-(--color-font)">
                                    {errMsgMapForConflictMergeResult[item.key] && (
                                      <Icon icon="exclamation-triangle" className="mt-1 text-(--color-danger)" />
                                    )}
                                    <div>
                                      <div className="truncate">{item.name}</div>
                                      {errMsgMapForConflictMergeResult[item.key] &&
                                        selectedConflictKey === item.key && (
                                          <div className="mt-2 text-sm break-all whitespace-pre-wrap text-(--color-warning)">
                                            This file has syntax errors:
                                            <br />
                                            {errMsgMapForConflictMergeResult[item.key]}
                                          </div>
                                        )}
                                    </div>
                                  </GridListItem>
                                );
                              }
                              return null;
                            }}
                          </GridList>
                        </div>
                        <Button
                          aria-label="Resolve conflicts"
                          className="mb-1 flex h-10 items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                          onClick={event => {
                            event.preventDefault();

                            if (Object.entries(errMsgMapForConflictMergeResult).filter(([, val]) => val).length > 0) {
                              showModal(AlertModal, {
                                title: 'The following files have syntax errors and cannot be saved:',
                                message: Object.entries(errMsgMapForConflictMergeResult)
                                  .filter(([, val]) => val)
                                  .map(([key]) => (
                                    <div key={key}>{conflicts.find(({ key: itemKey }) => itemKey === key)?.name}</div>
                                  )),
                                addCancel: false,
                                okLabel: 'Ok',
                              });
                              return;
                            }

                            onResolveAllRef.current?.(
                              conflicts.map(c => ({
                                ...c,
                                resolutionSource:
                                  editorType === 'merge' ? RESOLUTION_SOURCE.MANUAL : RESOLUTION_SOURCE.CHOOSE,
                              })),
                            );
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
                          <Icon icon="code-merge" className="w-5" />
                          <span className="truncate">Resolve conflicts</span>
                        </Button>
                        <Button
                          type="button"
                          className="flex h-10 items-center justify-center gap-2 rounded-md bg-(--hl-xxs) px-4 text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                          // will trigger onOpenChange on ModalOverlay
                          onClick={close}
                        >
                          Cancel merge
                        </Button>
                      </div>
                    )}

                    {selectedConflict ? (
                      <>
                        {editorType === 'diff' && (
                          <div className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-0">
                            <Heading className="flex items-center gap-2 font-bold">
                              <Icon icon="code-compare" />
                              {selectedConflict.name}
                            </Heading>
                            <div className="flex w-full items-center gap-2">
                              <span className="flex flex-1 items-center gap-2 bg-(--hl-xs) p-2 text-xs font-semibold text-(--hl) uppercase">
                                <Icon icon="laptop" /> {labels.ours}
                              </span>
                              <span className="flex flex-1 items-center gap-2 bg-(--hl-xs) p-2 text-xs font-semibold text-(--hl) uppercase">
                                <Icon icon="globe" /> {labels.theirs}
                              </span>
                            </div>
                            <div className="flex-1 overflow-y-auto rounded-xs bg-(--hl-xs) p-2 text-(--color-font)">
                              <DiffEditor original={selectedConflictCurrent} modified={selectedConflictIncoming} />
                            </div>
                          </div>
                        )}
                        {editorType === 'merge' && (
                          <div className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-0">
                            <ol className="flex items-stretch gap-2">
                              <li className="flex flex-1 flex-col items-center gap-2 bg-(--hl-xs) p-2 text-center text-lg font-semibold text-(--hl)">
                                <span className="text-base leading-6">Current Changes</span>
                                <Button
                                  className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) aria-pressed:bg-(--hl-sm)"
                                  onClick={() => {
                                    showModal(AlertModal, {
                                      title: 'Confirm',
                                      message: `Taking all current changes will completely overwrite any choices or edits you’ve made already for ${selectedConflict.name}. Are you sure you want to continue?`,
                                      addCancel: true,
                                      okLabel: 'Confirm',
                                      onConfirm: () => {
                                        onMergeEditorResultChange(selectedConflictCurrent);
                                      },
                                    });
                                  }}
                                >
                                  Take all current changes
                                </Button>
                              </li>
                              <li className="flex flex-1 flex-col items-center justify-between gap-2 bg-(--hl-xs) p-2 pb-3 text-center text-lg font-semibold text-(--hl)">
                                <span className="text-base leading-6">Merge Result</span>
                                <span className="inline-block leading-6 font-bold text-(--color-font)">
                                  {selectedConflict.name}
                                </span>
                              </li>
                              <li className="flex flex-1 flex-col items-center gap-2 bg-(--hl-xs) p-2 text-center text-lg font-semibold text-(--hl)">
                                <span className="text-base leading-6">Incoming Changes</span>
                                <Button
                                  className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-bold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) aria-pressed:bg-(--hl-sm)"
                                  onClick={() => {
                                    showModal(AlertModal, {
                                      title: 'Confirm',
                                      message: `Taking all incoming changes will completely overwrite any choices or edits you’ve made already for ${selectedConflict.name}. Are you sure you want to continue?`,
                                      addCancel: true,
                                      okLabel: 'Confirm',
                                      onConfirm: () => {
                                        onMergeEditorResultChange(selectedConflictIncoming);
                                      },
                                    });
                                  }}
                                >
                                  Take all incoming changes
                                </Button>
                              </li>
                            </ol>
                            <div className="flex-1 overflow-y-auto rounded-xs bg-(--hl-xs) p-2 text-(--color-font)">
                              <MergeEditor
                                key={selectedConflictKey}
                                leftContent={selectedConflictCurrent}
                                rightContent={selectedConflictIncoming}
                                centerContent={selectedConflict?.mergeResult || ''}
                                onChange={onMergeEditorResultChange}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-4 p-2">
                        <Heading className="flex items-center justify-center gap-2 text-4xl font-semibold text-(--hl-md)">
                          <Icon icon="code-compare" />
                          Diff view
                        </Heading>
                        <p className="text-(--hl)">Select an item to compare</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
});

SyncMergeModal.displayName = 'SyncMergeModal';
