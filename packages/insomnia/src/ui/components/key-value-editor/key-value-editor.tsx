import React, { type FC, Fragment, useCallback, useMemo } from 'react';
import { Button, DropIndicator, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Popover, ToggleButton, Toolbar, useDragAndDrop } from 'react-aria-components';

import { describeByteSize, generateId } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
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
}) => {
  const [showDescription, setShowDescription] = React.useState(false);
  const { enabled: nunjucksEnabled } = useNunjucksEnabled();
  let pairsListItems = useMemo(
    () => pairs.length > 0 ? pairs.map(pair => ({ ...pair, id: pair.id || generateId('pair') })) : [createEmptyPair()],
    // Ensure same array data will not generate different kvPairs to avoid flash issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(pairs)]
  );
  const initialReadOnlyItems = readOnlyPairs?.map(pair => ({ ...pair, id: pair.id || generateId('pair') })) || [];

  const upsertPair = useCallback(function upsertPair(pairsListItems: Pair[], pair: Pair) {
    if (pairsListItems.find(item => item.id === pair.id)) {
      onChange(pairsListItems.map(item => (item.id === pair.id ? pair : item)));
    } else {
      onChange([...pairsListItems, pair]);
    }
  }, [onChange]);

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
      onChange(repositionInArray(pairsListItems, [...e.keys].map(key => key.toString()), pairsListItems.findIndex(item => item.id === e.target.key.toString())));
    },
    renderDragPreview(items) {
      const pair = pairsListItems.find(item => item.id === items[0]['text/plain']) || createEmptyPair();

      const element = document.querySelector(`[data-key="${pair.id}"]`);

      const isFile = 'type' in pair && pair.type === 'file';
      const isMultiline = 'type' in pair && pair.type === 'text' && pair.multiline;
      const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

      let valueEditor = (
        <div className="relative h-full w-full flex flex-1 px-2">
          <OneLineEditor
            id={'key-value-editor__value' + pair.id}
            placeholder={valuePlaceholder || 'Value'}
            defaultValue={pair.value}
            readOnly
            getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
            onChange={() => { }}
          />
        </div>
      );

      if (isFile) {
        valueEditor = (
          <FileInputButton
            showFileName
            showFileIcon
            disabled
            className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
            path={pair.fileName || ''}
            onChange={() => { }}
          />
        );
      }

      if (isMultiline) {
        valueEditor = (
          <Button
            isDisabled
            className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
          >
            <i className="fa fa-pencil-square-o space-right" />
            {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
          </Button>
        );
      }

      return (
        <div
          className="flex outline-none bg-[--color-bg] flex-shrink-0 h-[--line-height-sm] items-center gap-2 px-2"
          style={{
            width: element?.clientWidth,
          }}
        >
          <div slot="drag" className="cursor-grab invisible p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
            <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
          </div>
          <div className="relative h-full w-full flex flex-1 px-2">
            <OneLineEditor
              id={'key-value-editor__name' + pair.id}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              readOnly
              onChange={() => { }}
            />
          </div>
          {valueEditor}
          {showDescription && (
            <div className="relative h-full w-full flex flex-1 px-2">
              <OneLineEditor
                id={'key-value-editor__description' + pair.id}
                placeholder={descriptionPlaceholder || 'Description'}
                defaultValue={pair.description || ''}
                readOnly
                onChange={() => { }}
              />
            </div>
          )}
          <div className="flex flex-shrink-0 items-center gap-2 w-[5.75rem]" />
        </div>
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="data-[drop-target]:outline-[--color-surprise] z-10 outline-1 outline"
        />
      );
    },
  });

  return (
    <Fragment>
      <Toolbar className="content-box sticky top-0 z-10 bg-[var(--color-bg)] flex flex-shrink-0 border-b border-[var(--hl-md)] h-[var(--line-height-sm)] text-[var(--font-size-sm)]">
        <Button
          className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
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
          className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
        <ToggleButton
          className="px-4 py-1 h-full flex items-center justify-center gap-2 text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
          onChange={setShowDescription}
          isSelected={showDescription}
        >
          {({ isSelected }) => (
            <>
              <Icon className={isSelected ? 'text-[--color-success]' : ''} icon={isSelected ? 'toggle-on' : 'toggle-off'} />
              <span>Description</span>
            </>
          )}
        </ToggleButton>
      </Toolbar>
      {initialReadOnlyItems.length > 0 && (
        <ListBox
          aria-label='Key-value pairs readonly'
          selectionMode='none'
          dependencies={[showDescription, nunjucksEnabled]}
          className="flex pt-1 flex-col w-full overflow-y-auto flex-1 relative"
          items={initialReadOnlyItems}
        >
          {pair => {
            const isFile = pair.type === 'file';
            const isMultiline = pair.type === 'text' && pair.multiline;
            const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

            let valueEditor = (
              <div className="relative h-full w-full flex flex-1 px-2">
                <OneLineEditor
                  id={'key-value-editor__value' + pair.id}
                  placeholder={valuePlaceholder || 'Value'}
                  defaultValue={pair.value}
                  readOnly
                  getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
                  onChange={() => { }}
                />
              </div>
            );

            if (isFile) {
              valueEditor = (
                <FileInputButton
                  showFileName
                  showFileIcon
                  disabled
                  className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                  path={pair.fileName || ''}
                  onChange={() => { }}
                />
              );
            }

            if (isMultiline) {
              valueEditor = (
                <Button
                  isDisabled
                  className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                >
                  <i className="fa fa-pencil-square-o space-right" />
                  {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
                </Button>
              );
            }

            return (
              <ListBoxItem textValue={pair.name + '-' + pair.value} className="flex outline-none bg-[--color-bg] flex-shrink-0 h-[--line-height-sm] items-center gap-2 px-2">
                <div slot="drag" className="cursor-grab invisible p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
                  <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
                </div>
                <div className="relative h-full w-full flex flex-1 px-2">
                  <OneLineEditor
                    id={'key-value-editor__name' + pair.id}
                    placeholder={namePlaceholder || 'Name'}
                    defaultValue={pair.name}
                    readOnly
                    onChange={() => { }}
                  />
                </div>
                {valueEditor}
                {showDescription && (
                  <div className="relative h-full w-full flex flex-1 px-2">
                    <OneLineEditor
                      id={'key-value-editor__description' + pair.id}
                      placeholder={descriptionPlaceholder || 'Description'}
                      defaultValue={pair.description || ''}
                      readOnly
                      onChange={() => { }}
                    />
                  </div>
                )}
                <div className="flex flex-shrink-0 items-center gap-2 w-[5.75rem]" />
              </ListBoxItem>
            );
          }}
        </ListBox>
      )}
      <ListBox
        aria-label='Key-value pairs'
        selectionMode='none'
        className="flex pt-1 flex-col w-full overflow-y-auto flex-1 relative"
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[upsertPair, showDescription, nunjucksEnabled]}
        items={pairsListItems}
      >
        {pair => {
          const isFile = pair.type === 'file';
          const isMultiline = pair.type === 'text' && pair.multiline;
          const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

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
                className="px-2 py-1 w-full fle flex-shrink-0 flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                path={pair.fileName || ''}
                onChange={fileName => upsertPair(pairsListItems, { ...pair, fileName })}
              />
            );
          }

          if (isMultiline) {
            valueEditor = (
              <Button
                isDisabled={pair.disabled || isDisabled}
                className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                onPress={() => showModal(CodePromptModal, {
                  submitName: 'Done',
                  title: `Edit ${pair.name}`,
                  defaultValue: pair.value,
                  enableRender: nunjucksEnabled,
                  mode: pair.multiline && typeof pair.multiline === 'string' ? pair.multiline : 'text/plain',
                  onChange: (value: string) => upsertPair(pairsListItems, { ...pair, value }),
                  onModeChange: (mode: string) => upsertPair(pairsListItems, { ...pair, multiline: mode }),
                })}
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
              className={`grid relative outline-none bg-[--color-bg] flex-shrink-0 h-[--line-height-sm] gap-2 px-2 ${showDescription ? '[grid-template-columns:max-content_1fr_1fr_1fr_max-content]' : '[grid-template-columns:max-content_1fr_1fr_max-content]'}`}
            >
              <div slot="drag" className="cursor-grab p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
                <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
              </div>
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
              {valueEditor}
              {showDescription && (
                <OneLineEditor
                  id={'key-value-editor__description' + pair.id}
                  key={'key-value-editor__description' + pair.id + pair.disabled}
                  placeholder={descriptionPlaceholder || 'Description'}
                  defaultValue={pair.description || ''}
                  readOnly={pair.disabled || isDisabled}
                  onChange={description => upsertPair(pairsListItems, { ...pair, description })}
                />
              )}
              <Toolbar className="flex items-center gap-1">
                <MenuTrigger>
                  <Button
                    aria-label="Text mode"
                    className="flex items-center justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    <Icon icon="caret-down" />
                  </Button>
                  <Popover className="min-w-max overflow-y-hidden flex flex-col">
                    <Menu
                      className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
                      aria-label="Create a new request"
                      selectionMode="single"
                      selectedKeys={[selectedValueType]}
                      items={[
                        {
                          id: 'text',
                          name: 'Text',
                          textValue: 'Text',
                          onAction: () => upsertPair(pairsListItems, { ...pair, type: 'text', multiline: false }),
                        },
                        ...allowMultiline ? [
                          {
                            id: 'multiline-text',
                            name: 'Multiline text',
                            textValue: 'Multiline text',
                            onAction: () => upsertPair(pairsListItems, { ...pair, type: 'text', multiline: true }),
                          },
                        ] : [],
                        ...allowFile ? [
                          {
                            id: 'file',
                            name: 'File',
                            textValue: 'File',
                            onAction: () => upsertPair(pairsListItems, { ...pair, type: 'file' }),
                          },
                        ] : [],
                      ]}
                    >
                      {item => (
                        <MenuItem
                          key={item.id}
                          id={item.id}
                          onAction={item.onAction}
                          className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                          aria-label={item.name}
                        >
                          <span>{item.name}</span>
                        </MenuItem>
                      )}
                    </Menu>
                  </Popover>
                </MenuTrigger>
                <ToggleButton
                  className="flex items-center justify-center h-7 aspect-square rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onChange={isSelected => upsertPair(pairsListItems, { ...pair, disabled: !isSelected })}
                  isSelected={!pair.disabled}
                >
                  <Icon icon={pair.disabled ? 'square' : 'check-square'} />
                </ToggleButton>
                <PromptButton
                  disabled={pair.id === 'pair-empty' || isDisabled}
                  className="flex items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  confirmMessage=''
                  doneMessage=''
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
    </Fragment>
  );
};
