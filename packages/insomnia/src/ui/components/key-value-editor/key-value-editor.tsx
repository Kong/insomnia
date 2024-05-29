import { useResizeObserver } from '@react-aria/utils';
import React, { FC, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { FocusScope } from 'react-aria';
import { Button, Dialog, DialogTrigger, DropIndicator, GridList, GridListItem, Menu, MenuItem, MenuTrigger, Popover, ToggleButton, Toolbar, useDragAndDrop } from 'react-aria-components';
import { useListData } from 'react-stately';

import { describeByteSize, generateId } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor, OneLineEditorHandle } from '../codemirror/one-line-editor';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { CodePromptModal } from '../modals/code-prompt-modal';

const EditableOneLineEditorModal = ({
  id,
  defaultValue,
  placeholder,
  readOnly,
  getAutocompleteConstants,
  onChange,
}: {
  id: string;
  defaultValue: string;
  placeholder?: string;
  readOnly?: boolean;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  onChange: (value: string) => void;
}) => {
  const [value, setValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const editorRef = useRef<OneLineEditorHandle>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [buttonDimensions, setButtonDimensions] = useState<{
    width: number;
    height: number;
    top: number;
    left: number;
  } | null>(null);

  const onResize = useCallback(() => {
    if (buttonRef.current) {
      const width = buttonRef.current.offsetWidth;
      const height = buttonRef.current.offsetHeight;
      const { top, left } = buttonRef.current.getBoundingClientRect();

      setButtonDimensions({ width, height, top, left });
    }
  }, [buttonRef]);

  useResizeObserver({
    ref: buttonRef,
    onResize: onResize,
  });

  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(isOpen => {
        setIsOpen(isOpen);
        if (!isOpen) {
          onChange(value);
          setValue(value);
        }
      })}
    >
      <Button ref={buttonRef} className={`relative px-2 hover:bg-[--hl-sm] aria-pressed:bg-[--hl-md] focus:bg-[--hl-md] ${isOpen ? 'opacity-0' : ''}`}>
        <OneLineEditor
          id={id}
          key={(isOpen ? 'open' : 'closed') + value}
          placeholder={placeholder}
          defaultValue={value}
          readOnly
          getAutocompleteConstants={getAutocompleteConstants}
          onChange={() => { }}
        />
        <span className='absolute top-0 left-0 w-full h-full' />
      </Button>
      <Popover
        offset={0}
        placement='start top'
        style={{
          '--trigger-width': buttonDimensions?.width ? `${buttonDimensions.width}px` : '0',
          '--trigger-height': buttonDimensions?.height ? `${buttonDimensions.height}px` : '0',
          '--trigger-top': buttonDimensions?.top ? `${buttonDimensions.top}px` : '0',
          '--trigger-left': buttonDimensions?.left ? `${buttonDimensions.left}px` : '0',
        } as React.CSSProperties}
        className="transform text-[--color-font] px-2 !z-10 w-[--trigger-width] h-[--trigger-height] top-[--trigger-top] left-[--trigger-left] flex relative overflow-y-auto focus:outline-none"
      >
        <Dialog className='w-full outline-none'>
          <FocusScope autoFocus>
            <div
              className='w-full h-full'
              onFocus={() => {
                editorRef.current?.focusEnd();
              }}
            >
              <OneLineEditor
                id={id}
                ref={editorRef}
                placeholder={placeholder}
                defaultValue={value}
                readOnly={readOnly}
                getAutocompleteConstants={getAutocompleteConstants}
                onChange={setValue}
              />
            </div>
          </FocusScope>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};

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
  const pairsList = useListData({
    initialItems: pairs.map(pair => {
      const paidId = pair.id || generateId('pair');
      return { ...pair, id: paidId, key: paidId };
    }),
    getKey: item => item.key,
  });

  const items = pairsList.items.length > 0 ? pairsList.items : [{ id: generateId('pair'), key: generateId('pair'), name: '', value: '', description: '', disabled: false }];

  const readOnlyPairsList = useListData({
    initialItems: readOnlyPairs?.map(pair => {
      const paidId = pair.id || generateId('pair');
      return { ...pair, id: paidId, key: paidId };
    }),
    getKey: item => item.key,
  });

  const gridListRef = useRef<HTMLDivElement>(null);

  // @TODO stable ref or do it on updater functions
  useEffect(() => {
    onChange(pairsList.items.map(({ key, ...item }) => item));
  }, [pairsList.items]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys =>
      [...keys].map(key => {
        const pair = pairsList.getItem(key);
        return { 'text/plain': `${pair.name}: ${pair.value}` };
      }),
    onReorder(e) {
      if (e.target.dropPosition === 'before') {
        pairsList.moveBefore(e.target.key, e.keys);
      } else if (e.target.dropPosition === 'after') {
        pairsList.moveAfter(e.target.key, e.keys);
      }
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="data-[drop-target]:outline-[--color-surprise] outline-1 outline"
        />
      );
    },
  });

  useEffect(() => {
    const refElement = gridListRef.current;
    console.log({ refElement });

    if (!refElement) {
      return;
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.stopPropagation();
      }
    };

    // refElement.addEventListener('keydown', handleKeydown, true);

    return () => {
      refElement.removeEventListener('keydown', handleKeydown, true);
    };
  }, []);

  return (
    <Fragment>
      <Toolbar className="content-box sticky top-0 z-10 bg-[var(--color-bg)] flex flex-shrink-0 border-b border-[var(--hl-md)] h-[var(--line-height-sm)] text-[var(--font-size-sm)]">
        <Button
          className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
          onPress={() => {
            const id = generateId('pair');
            pairsList.append({ id, key: id, name: '', value: '', description: '', disabled: false });
          }}
        >
          <Icon icon="plus" /> Add
        </Button>
        <PromptButton
          onClick={() => {
            pairsList.setSelectedKeys(new Set(pairsList.items.map(item => item.key)));
            pairsList.removeSelectedItems();
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
      {readOnlyPairsList.items.length > 0 && (
        <GridList
          selectionMode='none'
          dependencies={[showDescription, nunjucksEnabled]}
          className="flex pt-1 flex-col w-full overflow-y-auto flex-1 relative"
          aria-label='Key-value readonly'
          dragAndDropHooks={dragAndDropHooks}
          items={readOnlyPairsList.items}
        >
          {pair => {
            const isFileOrMultiline = allowMultiline || allowFile;
            const hiddenButtons = isFileOrMultiline ? (<button>
              <i className="fa fa-empty" />
            </button>) : null;

            const isFile = pair.type === 'file';
            const isMultiline = pair.type === 'text' && pair.multiline;
            const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

            return (
              <GridListItem className="flex outline-none bg-[--color-bg] flex-shrink-0 h-[--line-height-sm] items-center gap-2 px-2 data-[dragging]:opacity-50">
                <Button slot="drag" className="cursor-grab invisible p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
                  <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
                </Button>
                <OneLineEditor
                  id={'key-value-editor__name' + pair.id}
                  placeholder={namePlaceholder || 'Name'}
                  defaultValue={pair.name}
                  readOnly
                  onChange={() => { }}
                />
                <OneLineEditor
                  id={'key-value-editor__value' + pair.id}
                  placeholder={valuePlaceholder || 'Value'}
                  defaultValue={pair.value}
                  readOnly
                  getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
                  onChange={() => { }}
                />
                {showDescription && (
                  <OneLineEditor
                    id={'key-value-editor__description' + pair.id}
                    placeholder={descriptionPlaceholder || 'Description'}
                    defaultValue={pair.description || ''}
                    readOnly
                    onChange={() => { }}
                  />
                )}
                <Toolbar className="flex invisible items-center gap-2">
                  <MenuTrigger>
                    <Button
                      aria-label="Create in collection"
                      className="flex items-center justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    >
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover className="min-w-max">
                      <Menu
                        aria-label="Create a new request"
                        selectionMode="single"
                        selectedKeys={[pair.type === 'text' && pair.multiline ? 'multiline-text' : 'text']}
                        items={[
                          {
                            id: 'text',
                            name: 'Text',
                            textValue: 'Text',
                            onAction: () => {
                              pairsList.update(pair.id, { ...pair, type: 'text', multiline: false });
                            },
                          },
                          {
                            id: 'multiline-text',
                            name: 'Multiline text',
                            textValue: 'Multiline text',
                            onAction: () => {
                              pairsList.update(pair.id, { ...pair, type: 'text', multiline: true });
                            },
                          },
                        ]}
                        className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
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
                    onChange={isSelected => {
                      pairsList.update(pair.id, { ...pair, disabled: !isSelected });
                    }}
                    isSelected={!pair.disabled}
                  >
                    <Icon icon={pair.disabled ? 'square' : 'check-square'} />
                  </ToggleButton>
                  <PromptButton
                    className="flex items-center justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                    confirmMessage=''
                    onClick={() => {
                      pairsList.remove(pair.id);
                    }}
                  >
                    <Icon icon="trash-can" />
                  </PromptButton>
                </Toolbar>
              </GridListItem>
            );
          }}
        </GridList>
      )}
      <GridList
        selectionMode='none'
        disabledBehavior='all'
        dependencies={[showDescription, nunjucksEnabled]}
        className="flex pt-1 flex-col w-full overflow-y-auto flex-1 relative"
        aria-label='Key-value'
        dragAndDropHooks={dragAndDropHooks}
        items={items}
      >
        {pair => {
          const isFile = pair.type === 'file';
          const isMultiline = pair.type === 'text' && pair.multiline;
          const bytes = isMultiline ? Buffer.from(pair.value, 'utf8').length : 0;

          let valueEditor = (
            <EditableOneLineEditorModal
              id={'key-value-editor__value' + pair.id}
              placeholder={valuePlaceholder || 'Value'}
              defaultValue={pair.value}
              readOnly={isDisabled}
              getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
              onChange={value => {
                pairsList.update(pair.id, { ...pair, value });
              }}
            />
          );

          if (isFile) {
            valueEditor = (
              <FileInputButton
                showFileName
                showFileIcon
                disabled={isDisabled}
                className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                path={pair.fileName || ''}
                onChange={fileName => {
                  pairsList.update(pair.id, { ...pair, fileName });
                }}
              />
            );
          }

          if (isMultiline) {
            valueEditor = (
              <Button
                isDisabled={isDisabled}
                className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
                onPress={() => showModal(CodePromptModal, {
                  submitName: 'Done',
                  title: `Edit ${pair.name}`,
                  defaultValue: pair.value,
                  onChange: (value: string) => {
                    pairsList.update(pair.id, { ...pair, value });
                  },
                  enableRender: nunjucksEnabled,
                  mode: pair.multiline && typeof pair.multiline === 'string' ? pair.multiline : 'text/plain',
                  onModeChange: (mode: string) => {
                    pairsList.update(pair.id, { ...pair, multiline: mode });
                  },
                })}
              >
                <i className="fa fa-pencil-square-o space-right" />
                {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
              </Button>
            );
          }

          return (
            <GridListItem id={pair.id} className={`grid outline-none bg-[--color-bg] flex-shrink-0 h-[--line-height-sm] gap-2 px-2 data-[dragging]:opacity-50 ${showDescription ? '[grid-template-columns:max-content_1fr_1fr_1fr_max-content]' : '[grid-template-columns:max-content_1fr_1fr_max-content]'}`}>
              <Button slot="drag" className="cursor-grab p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
                <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
              </Button>
              <EditableOneLineEditorModal
                id={'key-value-editor__name' + pair.id}
                placeholder={namePlaceholder || 'Name'}
                defaultValue={pair.name}
                readOnly={isDisabled}
                getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(pair) || []}
                onChange={name => {
                  pairsList.update(pair.id, { ...pair, name });
                }}
              />
              {valueEditor}
              {showDescription && (
                <EditableOneLineEditorModal
                  id={'key-value-editor__description' + pair.id}
                  placeholder={descriptionPlaceholder || 'Description'}
                  defaultValue={pair.description || ''}
                  readOnly={isDisabled}
                  onChange={description => {
                    pairsList.update(pair.id, { ...pair, description });
                  }}
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
                  <Popover className="min-w-max">
                    <Menu
                      aria-label="Create a new request"
                      selectionMode="single"
                      selectedKeys={[pair.type === 'text' && pair.multiline ? 'multiline-text' : 'text']}
                      items={[
                        {
                          id: 'text',
                          name: 'Text',
                          textValue: 'Text',
                          onAction: () => {
                            pairsList.update(pair.id, { ...pair, type: 'text', multiline: false });
                          },
                        },
                        {
                          id: 'multiline-text',
                          name: 'Multiline text',
                          textValue: 'Multiline text',
                          onAction: () => {
                            pairsList.update(pair.id, { ...pair, type: 'text', multiline: true });
                          },
                        },
                      ]}
                      className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
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
                  onChange={isSelected => {
                    pairsList.update(pair.id, { ...pair, disabled: !isSelected });
                  }}
                  isSelected={!pair.disabled}
                >
                  <Icon icon={pair.disabled ? 'square' : 'check-square'} />
                </ToggleButton>
                <PromptButton
                  className="flex items-center justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  confirmMessage=''
                  onClick={() => {
                    pairsList.remove(pair.id);
                  }}
                >
                  <Icon icon="trash-can" />
                </PromptButton>
              </Toolbar>
            </GridListItem>
          );
        }}
      </GridList>
    </Fragment >
  );
};
