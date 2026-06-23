import React, { type FC, Fragment, useCallback, useMemo, useState } from 'react';
import {
  Button,
  DropIndicator,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  ToggleButton,
  Toolbar,
  useDragAndDrop,
} from 'react-aria-components';

import { utf8ByteLength } from '~/common/utils/utf8-bytes';
import { OneLineEditor } from '~/ui/components/.client/codemirror/one-line-editor';

import { describeByteSize, generateId } from '../../../common/misc';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { CodePromptModal } from '../modals/code-prompt-modal';

interface Pair {
  id?: string;
  name: string;
  value: string;
  description?: string;
  fileName?: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean | string;
  canDisable?: boolean;
}

function createEmptyPair() {
  return {
    id: generateId('pair'),
    name: '',
    value: '',
    description: '',
    disabled: false,
  };
}

type AutocompleteHandler = (pair: Pair) => string[] | PromiseLike<string[]>;

interface Props {
  allowFile?: boolean;
  allowMultiline?: boolean;
  descriptionPlaceholder?: string;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  isDisabled?: boolean;
  namePlaceholder?: string;
  onChange: (pairs: Pair[]) => void;
  pairs: Pair[];
  valuePlaceholder?: string;
  onBlur?: (e: FocusEvent) => void;
  readOnlyPairs?: Pair[];
  readOnlyDisabledByName?: Record<string, boolean>;
  onReadOnlyDisabledChange?: (name: string, disabled: boolean) => void;
  onDescriptionToggle?: () => void;
}

export const KeyValueEditor: FC<Props> = ({
  allowFile,
  allowMultiline,
  descriptionPlaceholder,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  isDisabled,
  namePlaceholder,
  onChange,
  pairs,
  valuePlaceholder,
  readOnlyPairs,
  readOnlyDisabledByName,
  onReadOnlyDisabledChange,
  onDescriptionToggle,
}) => {
  const [showDescription, setShowDescription] = useState(
    pairs.some(p => p.description && p.description.trim() !== '') || false,
  );
  let pairsListItems = useMemo(
    () =>
      pairs.length > 0 ? pairs.map(pair => ({ ...pair, id: pair.id || generateId('pair') })) : [createEmptyPair()],
    // Ensure same array data will not generate different kvPairs to avoid flash issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pairs)],
  );
  const initialReadOnlyItems = readOnlyPairs?.map(pair => ({ ...pair, id: pair.id || generateId('pair') })) || [];

  const upsertPair = useCallback(
    function upsertPair(pairsListItems: Pair[], pair: Pair) {
      if (pairsListItems.find(item => item.id === pair.id)) {
        onChange(pairsListItems.map(item => (item.id === pair.id ? pair : item)));
      } else {
        onChange([...pairsListItems, pair]);
      }
    },
    [onChange],
  );

  const repositionInArray = (allItems: Pair[], itemsToMove: string[], targetIndex: number) => {
    const removed = allItems.filter(item => item.id !== itemsToMove[0]);
    const itemToMove = allItems.find(item => item.id === itemsToMove[0]);
    if (itemToMove) {
      return [...removed.slice(0, targetIndex), itemToMove, ...removed.slice(targetIndex)];
    }
    return allItems;
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => ({ 'text/plain': `${pairsListItems.find(item => item.id === key.toString())?.id}` })),
    onReorder(e) {
      onChange(
        repositionInArray(
          pairsListItems,
          [...e.keys].map(key => key.toString()),
          pairsListItems.findIndex(item => item.id === e.target.key.toString()),
        ),
      );
    },
    renderDragPreview(items) {
      const pair = pairsListItems.find(item => item.id === items[0]['text/plain']) || createEmptyPair();

      const element = document.querySelector(`[data-key="${pair.id}"]`);

      const isFile = 'type' in pair && pair.type === 'file';
      const isMultiline = 'type' in pair && pair.type === 'text' && pair.multiline;
      const bytes = isMultiline ? utf8ByteLength(pair.value) : 0;

      let valueEditor = (
        <div className="relative flex h-full w-full flex-1 px-2">
          <OneLineEditor
            id={'key-value-editor__value' + pair.id}
            placeholder={valuePlaceholder || 'Value'}
            defaultValue={pair.value}
            readOnly
            getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
            onChange={() => {}}
          />
        </div>
      );

      if (isFile) {
        valueEditor = (
          <FileInputButton
            showFileName
            showFileIcon
            disabled
            className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            path={pair.fileName || ''}
            onChange={() => {}}
          />
        );
      }

      if (isMultiline) {
        valueEditor = (
          <Button
            isDisabled
            className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <i className="fa fa-pencil-square-o space-right" />
            {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
          </Button>
        );
      }

      return (
        <div
          className="flex h-(--line-height-sm) shrink-0 items-center gap-2 bg-(--color-bg) px-2 outline-hidden"
          style={{
            width: element?.clientWidth,
          }}
        >
          <div
            slot="drag"
            className="invisible flex w-5 shrink-0 cursor-grab items-center justify-center p-2 focus-visible:bg-(--hl-sm)"
          >
            <Icon icon="grip-vertical" className="w-2 text-(--hl)" />
          </div>
          <div className="relative flex h-full w-full flex-1 px-2">
            <OneLineEditor
              id={'key-value-editor__name' + pair.id}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              readOnly
              onChange={() => {}}
            />
          </div>
          {valueEditor}
          {showDescription && (
            <div className="relative flex h-full w-full flex-1 px-2">
              <OneLineEditor
                id={'key-value-editor__description' + pair.id}
                placeholder={descriptionPlaceholder || 'Description'}
                defaultValue={pair.description || ''}
                readOnly
                onChange={() => {}}
              />
            </div>
          )}
          <div className="flex w-23 shrink-0 items-center gap-2" />
        </div>
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="z-10 outline-1 outline-solid data-drop-target:outline-(--color-surprise)"
        />
      );
    },
  });

  /* When the user presses a letter key and then immediately presses the space bar.
  The keydown event for the space key was stopped from propagating during the capture phase by the ListBox component
  That is why the inner editor fails to respond to the immediate space press behavior. 
  Here we add a wrapper to the outer ListBox and add a wrapper to the inner editor and listen to the keydown event in both wrapper
  When the user presses the space key, we change the event.key property with non-breakable space in the outer wrapper
  and change it back in the inner wrapper.
  */
  const onKeyDownOuter = useCallback<React.KeyboardEventHandler>(event => {
    if (event.key === ' ') {
      event.key = '\u00A0';
    }
  }, []);

  const onKeyDownInner = useCallback<React.KeyboardEventHandler>(event => {
    if (event.key === '\u00A0') {
      event.key = ' ';
    }
  }, []);

  return (
    <Fragment>
      <Toolbar className="content-box sticky top-0 z-10 flex h-(--line-height-sm) shrink-0 border-b border-(--hl-md) bg-(--color-bg) text-(--font-size-sm)">
        <Button
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          onPress={() => {
            const id = generateId('pair');
            upsertPair(pairsListItems, { id, name: '', value: '', description: '', disabled: false });
          }}
        >
          <Icon icon="plus" /> Add
        </Button>
        <PromptButton
          disabled={pairsListItems.length === 0}
          onClick={() => {
            pairsListItems = [createEmptyPair()];
            onChange([]);
          }}
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
        <ToggleButton
          className="flex h-full items-center justify-center gap-2 px-4 py-1 text-xs text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
          onChange={value => {
            setShowDescription(value);
            onDescriptionToggle?.();
          }}
          isSelected={showDescription}
        >
          {({ isSelected }) => (
            <>
              <Icon
                className={isSelected ? 'text-(--color-success)' : ''}
                icon={isSelected ? 'toggle-on' : 'toggle-off'}
              />
              <span>Description</span>
            </>
          )}
        </ToggleButton>
      </Toolbar>
      {initialReadOnlyItems.length > 0 && (
        <ListBox
          aria-label="Key-value pairs readonly"
          selectionMode="none"
          dependencies={[showDescription]}
          className="relative flex w-full flex-1 flex-col overflow-y-auto pt-1"
          items={initialReadOnlyItems}
        >
          {pair => {
            const isFile = pair.type === 'file';
            const isMultiline = pair.type === 'text' && pair.multiline;
            const bytes = isMultiline ? utf8ByteLength(pair.value) : 0;
            const lowerName = pair.name.toLowerCase();
            const isPairDisabled = !!readOnlyDisabledByName?.[lowerName];

            let valueEditor = (
              <OneLineEditor
                id={'key-value-editor__value' + pair.id}
                placeholder={valuePlaceholder || 'Value'}
                defaultValue={pair.value}
                readOnly
                getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
                onChange={() => {}}
              />
            );

            if (isFile) {
              valueEditor = (
                <FileInputButton
                  showFileName
                  showFileIcon
                  disabled
                  className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  path={pair.fileName || ''}
                  onChange={() => {}}
                />
              );
            }

            if (isMultiline) {
              valueEditor = (
                <Button
                  isDisabled
                  className="flex w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <i className="fa fa-pencil-square-o space-right" />
                  {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
                </Button>
              );
            }

            return (
              <ListBoxItem
                textValue={pair.name + '-' + pair.value}
                style={{ opacity: isPairDisabled ? '0.4' : '1' }}
                className={`relative grid h-(--line-height-sm) shrink-0 gap-2 bg-(--color-bg) px-2 outline-hidden ${showDescription ? 'grid-cols-[max-content_1fr_1fr_1fr_max-content]' : 'grid-cols-[max-content_1fr_1fr_max-content]'}`}
              >
                <div
                  slot="drag"
                  className="invisible flex w-5 shrink-0 cursor-grab items-center justify-center p-2 focus-visible:bg-(--hl-sm)"
                >
                  <Icon icon="grip-vertical" className="w-2 text-(--hl)" />
                </div>
                <div>
                  <OneLineEditor
                    id={'key-value-editor__name' + pair.id}
                    placeholder={namePlaceholder || 'Name'}
                    defaultValue={pair.name}
                    readOnly
                    onChange={() => {}}
                  />
                </div>
                <div>{valueEditor}</div>
                {showDescription && (
                  <div>
                    <OneLineEditor
                      id={'key-value-editor__description' + pair.id}
                      placeholder={descriptionPlaceholder || 'Description'}
                      defaultValue={pair.description || ''}
                      readOnly
                      onChange={() => {}}
                    />
                  </div>
                )}
                <Toolbar className="flex items-center gap-1">
                  {pair.canDisable && onReadOnlyDisabledChange ? (
                    <ToggleButton
                      className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                      onChange={isSelected => onReadOnlyDisabledChange(lowerName, !isSelected)}
                      isSelected={!isPairDisabled}
                    >
                      <Icon icon={isPairDisabled ? 'square' : 'check-square'} />
                    </ToggleButton>
                  ) : (
                    <div aria-hidden="true" className="aspect-square h-7" />
                  )}
                  <div aria-hidden="true" className="aspect-square h-7" />
                </Toolbar>
              </ListBoxItem>
            );
          }}
        </ListBox>
      )}
      <div onKeyDownCapture={onKeyDownOuter} className="relative flex w-full flex-col overflow-hidden">
        <ListBox
          aria-label="Key-value pairs"
          selectionMode="none"
          className="relative flex w-full flex-1 flex-col overflow-y-auto pt-1"
          dragAndDropHooks={dragAndDropHooks}
          dependencies={[upsertPair, showDescription]}
          items={pairsListItems}
        >
          {pair => {
            const isFile = pair.type === 'file';
            const isMultiline = pair.type === 'text' && pair.multiline;
            const bytes = isMultiline ? utf8ByteLength(pair.value) : 0;
            const isOnlyTextAllowed = !allowFile && !allowMultiline;

            let valueEditor = (
              <OneLineEditor
                id={'key-value-editor__value' + pair.id}
                key={'key-value-editor__value' + pair.id + pair.disabled}
                placeholder={valuePlaceholder || 'Value'}
                defaultValue={pair.value}
                readOnly={pair.disabled || isDisabled}
                getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
                onChange={value => upsertPair(pairsListItems, { ...pair, value })}
              />
            );

            if (isFile) {
              valueEditor = (
                <FileInputButton
                  showFileName
                  showFileIcon
                  disabled={pair.disabled || isDisabled}
                  className="flex h-full w-full flex-1 shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  path={pair.fileName || ''}
                  onChange={fileName => upsertPair(pairsListItems, { ...pair, fileName })}
                />
              );
            }

            if (isMultiline) {
              valueEditor = (
                <Button
                  isDisabled={pair.disabled || isDisabled}
                  className="flex h-full w-full flex-1 items-center justify-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() =>
                    showModal(CodePromptModal, {
                      submitName: 'Done',
                      title: `Edit ${pair.name}`,
                      defaultValue: pair.value,
                      mode: pair.multiline && typeof pair.multiline === 'string' ? pair.multiline : 'text/plain',
                      onChange: (value: string) => upsertPair(pairsListItems, { ...pair, value }),
                      onModeChange: (mode: string) => upsertPair(pairsListItems, { ...pair, multiline: mode }),
                    })
                  }
                >
                  <i className="fa fa-pencil-square-o space-right" />
                  {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
                </Button>
              );
            }

            let selectedValueType = 'text';

            if (isFile) {
              selectedValueType = 'file';
            } else if (isMultiline) {
              selectedValueType = 'multiline-text';
            }

            return (
              <ListBoxItem
                id={pair.id}
                key={pair.id}
                textValue={pair.name + '-' + pair.value}
                style={{ opacity: pair.disabled ? '0.4' : '1' }}
                className={`relative grid h-(--line-height-sm) shrink-0 gap-2 bg-(--color-bg) px-2 outline-hidden ${showDescription ? 'grid-cols-[max-content_1fr_1fr_1fr_max-content]' : 'grid-cols-[max-content_1fr_1fr_max-content]'}`}
              >
                <div
                  slot="drag"
                  className="flex w-5 shrink-0 cursor-grab items-center justify-center p-2 focus-visible:bg-(--hl-sm)"
                >
                  <Icon icon="grip-vertical" className="w-2 text-(--hl)" />
                </div>
                <div onKeyDownCapture={onKeyDownInner}>
                  <OneLineEditor
                    id={'key-value-editor__name' + pair.id}
                    key={'key-value-editor__name' + pair.id + pair.disabled}
                    placeholder={namePlaceholder || 'Name'}
                    defaultValue={pair.name}
                    readOnly={pair.disabled || isDisabled}
                    getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(pair) || []}
                    onChange={name => {
                      upsertPair(pairsListItems, { ...pair, name });
                    }}
                  />
                </div>
                <div onKeyDownCapture={onKeyDownInner}>{valueEditor}</div>
                {showDescription && (
                  <div onKeyDownCapture={onKeyDownInner}>
                    <OneLineEditor
                      id={'key-value-editor__description' + pair.id}
                      key={'key-value-editor__description' + pair.id + pair.disabled}
                      placeholder={descriptionPlaceholder || 'Description'}
                      defaultValue={pair.description || ''}
                      readOnly={pair.disabled || isDisabled}
                      onChange={description => upsertPair(pairsListItems, { ...pair, description })}
                    />
                  </div>
                )}
                <Toolbar className="flex items-center gap-1">
                  {!isOnlyTextAllowed && (
                    <MenuTrigger>
                      <Button
                        aria-label="Text mode"
                        className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      >
                        <Icon icon="caret-down" />
                      </Button>
                      <Popover className="flex min-w-max flex-col overflow-y-hidden">
                        <Menu
                          className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                          aria-label="Select value type"
                          selectionMode="single"
                          selectedKeys={[selectedValueType]}
                          items={[
                            {
                              id: 'text',
                              name: 'Text',
                              textValue: 'Text',
                              onAction: () => upsertPair(pairsListItems, { ...pair, type: 'text', multiline: false }),
                            },
                            ...(allowMultiline
                              ? [
                                  {
                                    id: 'multiline-text',
                                    name: 'Multiline text',
                                    textValue: 'Multiline text',
                                    onAction: () =>
                                      upsertPair(pairsListItems, { ...pair, type: 'text', multiline: true }),
                                  },
                                ]
                              : []),
                            ...(allowFile
                              ? [
                                  {
                                    id: 'file',
                                    name: 'File',
                                    textValue: 'File',
                                    onAction: () => upsertPair(pairsListItems, { ...pair, type: 'file' }),
                                  },
                                ]
                              : []),
                          ]}
                        >
                          {item => (
                            <MenuItem
                              key={item.id}
                              id={item.id}
                              onAction={item.onAction}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.name}
                            >
                              <span>{item.name}</span>
                            </MenuItem>
                          )}
                        </Menu>
                      </Popover>
                    </MenuTrigger>
                  )}
                  <ToggleButton
                    className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset"
                    onChange={isSelected => upsertPair(pairsListItems, { ...pair, disabled: !isSelected })}
                    isSelected={!pair.disabled}
                    isDisabled={isDisabled}
                  >
                    <Icon icon={pair.disabled ? 'square' : 'check-square'} />
                  </ToggleButton>
                  <PromptButton
                    disabled={pair.id === 'pair-empty' || isDisabled}
                    className="flex aspect-square h-7 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
                    confirmMessage=""
                    doneMessage=""
                    onClick={() => {
                      if (pairsListItems.find(item => item.id === pair.id)) {
                        pairsListItems = pairsListItems.filter(item => item.id !== pair.id);
                        if (pairsListItems.length === 0) {
                          pairsListItems.push(createEmptyPair());
                        }
                        onChange(pairsListItems);
                      }
                    }}
                  >
                    <Icon icon="trash-can" />
                  </PromptButton>
                </Toolbar>
              </ListBoxItem>
            );
          }}
        </ListBox>
      </div>
    </Fragment>
  );
};
