import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, type ButtonProps, DropIndicator, ListBox, ListBoxItem, Menu, MenuItem, MenuTrigger, Popover, Toolbar, useDragAndDrop } from 'react-aria-components';

import { generateId } from '../../../../common/misc';
import { type EnvironmentKvPairData, EnvironmentKvPairDataType } from '../../../../models/environment';
import { PromptButton } from '../../base/prompt-button';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { Icon } from '../../icon';
import { CodePromptModal, type CodePromptModalHandle } from '../../modals/code-prompt-modal';
import { Tooltip } from '../../tooltip';
import { checkNestedKeys, ensureKeyIsValid } from '../environment-utils';

interface EditorProps {
  data: EnvironmentKvPairData[];
  onChange: (newPair: EnvironmentKvPairData[]) => void;
}
const cellCommonStyle = 'h-full px-2  flex items-center';

const createNewPair = (enabled: boolean = true): EnvironmentKvPairData => ({
  id: generateId('envPair'),
  name: '',
  value: '',
  type: EnvironmentKvPairDataType.STRING,
  enabled,
});

// Add tab index -1 to button so that user can use tab navigation to editors
const ItemButton = (props: ButtonProps & { tabIndex?: number }) => {
  const { tabIndex, ...restProps } = props;
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (btnRef.current && typeof tabIndex === 'number') {
      // add tab index
      btnRef.current.tabIndex = tabIndex;
    }
  });

  return <Button {...restProps} ref={btnRef} />;
};

export const EnvironmentKVEditor = ({ data, onChange }: EditorProps) => {
  const kvPairs: EnvironmentKvPairData[] = useMemo(
    () => data.length > 0 ? [...data] : [createNewPair()],
    // Ensure same array data will not generate different kvPairs to avoid flash issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(data)]
  );
  const codeModalRef = useRef<CodePromptModalHandle>(null);
  const [kvPairError, setKvPairError] = useState<{ id: string; error: string }[]>([]);

  const repositionInArray = (moveItems: string[], targetIndex: number) => {
    const removed = kvPairs.filter(pair => pair.id !== moveItems[0]);
    const itemToMove = kvPairs.find(pair => pair.id === moveItems[0]);
    if (itemToMove) {
      return [...removed.slice(0, targetIndex), itemToMove, ...removed.slice(targetIndex)];
    }
    return kvPairs;
  };

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ 'text/plain': key.toString() })),
    onReorder(e) {
      const moveItems = [...e.keys].map(key => key.toString());
      const targetIndex = kvPairs.findIndex(pair => pair.id === e.target.key.toString());
      onChange(repositionInArray(moveItems, targetIndex));
    },
    renderDragPreview(items) {
      const pair = kvPairs.find(pair => pair.id === items[0]['text/plain']) || createNewPair();
      const element = document.querySelector(`[data-key="${pair.id}"]`);

      return (
        <div
          className='flex outline-none bg-[--color-bg] h-[--line-height-sm]'
          style={{
            width: element?.clientWidth,
          }}
        >
          {renderPairItem(pair)}
        </div>
      );
    },
    renderDropIndicator(target) {
      return (
        <DropIndicator
          target={target}
          className="outline-[--color-surprise] outline-1 outline !border-none"
        />
      );
    },
  });

  const handleItemChange = <K extends keyof EnvironmentKvPairData>(id: string, changedPropertyName: K, newValue: EnvironmentKvPairData[K]) => {
    const changedItemIdx = kvPairs.findIndex(p => p.id === id);
    if (changedItemIdx !== -1) {
      const changedItem = kvPairs[changedItemIdx];
      // enable item since user modifies the item unless manual disbale it
      changedItem['enabled'] = true;
      changedItem[changedPropertyName] = newValue;
      // update value to emptfy object json string when switch to json type and current value is empty string
      if (newValue === EnvironmentKvPairDataType.JSON && changedItem.value.trim() === '') {
        changedItem.value = JSON.stringify({});
      }
    }
    onChange(kvPairs);
  };

  const handleAddItem = (id?: string) => {
    const newPair = createNewPair();
    const insertIdx = id ? kvPairs.findIndex(d => d.id === id) : kvPairs.length - 1;
    kvPairs.splice(insertIdx === -1 ? 0 : insertIdx + 1, 0, newPair);
    onChange(kvPairs);
  };

  const handleDeleteItem = (id: string) => {
    const filteredPairs = kvPairs.filter(d => d.id !== id);
    onChange(filteredPairs);
  };

  const checkValidJSONString = (input: string) => {
    try {
      JSON.parse(input);
      return true;
    } catch (error) {
      return false;
    }
  };

  const kvPairItemTypes = [
    {
      id: EnvironmentKvPairDataType.STRING,
      name: 'Text',
    },
    {
      id: EnvironmentKvPairDataType.JSON,
      name: 'JSON',
    },
  ];

  const renderPairItem = (kvPair: EnvironmentKvPairData) => {
    const { id, name, value, type, enabled = false } = kvPair;
    const itemIndex = kvPairs.findIndex(pair => pair.id === id);
    const itemError = kvPairError.find(p => p.id === id);
    const hasItemWithSameNameAfter = name !== '' && kvPairs.slice(itemIndex + 1).some(pair => pair.name.trim() === name.trim() && pair.enabled);
    const isValidJSONString = checkValidJSONString(value);
    return (
      <>
        <div slot="drag" className={`${cellCommonStyle} w-6 flex flex-shrink-0 items-center justify-end border-l border-r-0`} style={{ padding: 0 }}>
          <Icon icon="grip-vertical" className="cursor-grab mr-1" />
        </div>
        <div className={`${cellCommonStyle} relative h-full w-[30%] flex flex-grow pl-1`}>
          <OneLineEditor
            id={`environment-kv-editor-name-${id}`}
            placeholder={'Input Name'}
            defaultValue={name}
            readOnly={!enabled}
            onChange={newName => {
              // check filed names for invalid '$' for '.' sign
              const error = ensureKeyIsValid(newName, true);
              if (error) {
                if (itemError) {
                  setKvPairError(kvPairError.map(p => p.id === id ? { id, error } : p));
                } else {
                  setKvPairError([...kvPairError, { id, error }]);
                }
              } else {
                if (itemError) {
                  setKvPairError(kvPairError.filter(p => p.id !== id));
                }
                handleItemChange(id, 'name', newName);
              }
            }}
          />
          {itemError &&
            <Tooltip message={itemError.error} delay={200}>
              <i className="fa fa-exclamation-circle text-[--color-danger]" />
            </Tooltip>
          }
          {hasItemWithSameNameAfter &&
            <Tooltip message={`Duplicate name: ${name}. Only the last item with same name will be used.`} delay={200}>
              <i className="fa fa-exclamation-circle text-[--color-warning]" />
            </Tooltip>
          }
        </div>
        <div className={`${cellCommonStyle} w-[50%] relative`}>
          {type === EnvironmentKvPairDataType.STRING ?
            <OneLineEditor
              id={`environment-kv-editor-value-${id}`}
              placeholder={'Input Value'}
              defaultValue={value.toString()}
              readOnly={!enabled}
              onChange={newValue => handleItemChange(id, 'value', newValue)}
            /> :
            <ItemButton
              className="px-2 py-1 w-full flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm overflow-hidden"
              tabIndex={-1}
              isDisabled={!enabled}
              onPress={() => {
                if (codeModalRef.current) {
                  const modalRef = codeModalRef.current;
                  modalRef.setError('');
                  modalRef.show({
                    submitName: 'Done',
                    title: `Edit ${name} value`,
                    enableRender: true,
                    defaultValue: value.toString(),
                    mode: 'application/json',
                    onChange: (value: string) => {
                      modalRef.setError('');
                      try {
                        const err = checkNestedKeys(JSON.parse(value));
                        if (err) {
                          modalRef.setError(err);
                        } else {
                          handleItemChange(id, 'value', value);
                        }
                      } catch (error) {
                        modalRef.setError(error.message);
                      }
                    },
                    hideMode: true,
                  });
                }
              }}
            >
              <i className="fa fa-pencil-square-o space-right" aria-label='Edit JSON' />Click to Edit
            </ItemButton>
          }
        </div>
        <div className={`${cellCommonStyle} w-32`} >
          <MenuTrigger>
            <ItemButton className="py-1 px-[--padding-sm] w-full font-bold flex flex-1 items-center justify-between aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] text-sm" tabIndex={-1} aria-label='Type Selection'>
              <span className="flex truncate items-center justify-center gap-2" >{kvPairItemTypes.find(t => t.id === type)?.name}</span>
              <Icon icon="caret-down" />
            </ItemButton>
            <Popover className='border-solid border-[--hl-sm] shadow-lg bg-[--color-bg]'>
              <Menu
                aria-label='environment-kv-editor-type-selector'
                selectionMode="single"
                selectedKeys={[type]}
                // Only valid json string or empty string allowed to convert to JSON type
                disabledKeys={isValidJSONString || value.trim() === '' ? [] : [EnvironmentKvPairDataType.JSON]}
                items={kvPairItemTypes}
              >
                {item => (
                  <MenuItem
                    key={item.id}
                    id={item.id}
                    className="aria-disabled:text-[--hl-lg] aria-disabled:cursor-not-allowed aria-disabled:bg-transparent flex gap-2 pl-[--padding-sm] pr-[--padding-xl] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full
                      text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors text-sm react-aria-ListBoxItem"
                    aria-label={item.name}
                    onAction={() => handleItemChange(id, 'type', item.id)}
                  >
                    {({ isSelected }) => (
                      <>
                        <span>{item.name}</span>
                        {isSelected && (
                          <Icon
                            icon="check"
                            className="text-[--color-success] justify-self-end"
                          />
                        )}
                      </>
                    )}
                  </MenuItem>
                )}
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <div className={`${cellCommonStyle} w-20`} >
          <ItemButton
            className="flex items-center justify-center h-7 aspect-square rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            tabIndex={-1}
            aria-label={enabled ? 'Disable Row' : 'Enable Row'}
            onPress={() => handleItemChange(id, 'enabled', !enabled)}
          >
            <Icon icon={enabled ? 'check-square' : 'square'} />
          </ItemButton>
          <PromptButton
            className="flex	items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            fullWidth
            confirmMessage=''
            doneMessage=''
            ariaLabel='Delete Row'
            tabIndex={-1}
            onClick={() => handleDeleteItem(id)}
          >
            <Icon icon="trash-can" />
          </PromptButton>
        </div>
      </>
    );
  };

  return (
    <div className="min-w-max h-full overflow-hidden flex flex-col">
      <Toolbar className="content-box z-10 bg-[var(--color-bg)] flex flex-shrink-0 h-[var(--line-height-sm)] text-[var(--font-size-sm)]">
        <Button
          className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
          aria-label='Add Row'
          onPress={() => {
            handleAddItem();
          }}
        >
          <Icon icon="plus" /> Add
        </Button>
        <PromptButton
          disabled={kvPairs.length === 0}
          onClick={() => {
            onChange([]);
          }}
          ariaLabel='Delete All'
          className="px-4 py-1 h-full flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] text-xs hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all"
        >
          <Icon icon="trash-can" />
          <span>Delete all</span>
        </PromptButton>
      </Toolbar>
      <ListBox
        aria-label='Environment Key Value Pair'
        selectionMode='none'
        dragAndDropHooks={dragAndDropHooks}
        dependencies={[kvPairError, data]}
        className="p-[--padding-sm] w-full overflow-y-auto h-full"
        items={kvPairs}
      >
        {kvPair => {
          const { id, name, enabled } = kvPair;
          return (
            <ListBoxItem
              key={id}
              id={id}
              textValue={`environment-item-${name || id}`}
              style={{ opacity: enabled ? '1' : '0.4' }}
              className={'w-full flex focus:outline-none  h-[--line-height-sm]'}
            >
              {renderPairItem(kvPair)}
            </ListBoxItem>
          );
        }}
      </ListBox>
      <CodePromptModal
        ref={codeModalRef}
      />
    </div>
  );
};
EnvironmentKVEditor.displayName = 'EnvironmentKeyValueEditor';
