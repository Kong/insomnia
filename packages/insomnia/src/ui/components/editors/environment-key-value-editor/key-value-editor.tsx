import React, { forwardRef, useRef } from 'react';
import { Button, DropIndicator, ListBox, ListBoxItem, Popover, Select, SelectValue, ToggleButton, useDragAndDrop } from 'react-aria-components';

import { generateId } from '../../../../common/misc';
import { type EnvironmentKvPairData, EnvironmentKvPairDataType } from '../../../../models/environment';
import { PromptButton } from '../../base/prompt-button';
import { CodeEditor } from '../../codemirror/code-editor';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { Icon } from '../../icon';
import type { EnvironmentEditorHandle } from '../environment-editor';
import { checkNestedKeys } from '../environment-utils';

interface EditorProps {
  data: EnvironmentKvPairData[];
  onChange: (newPari: EnvironmentKvPairData[]) => void;
}
const headerStyle = 'normal-case p-2 z-10 border-b border-r border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none';
const cellCommonStyle = 'h-full px-2 border-b border-r border-solid border-[--hl-sm] flex items-center';

const createNewPair = (): EnvironmentKvPairData => ({
  id: generateId('envPair'),
  name: '',
  value: '',
  type: EnvironmentKvPairDataType.STRING,
  enabled: false,
});

export const EnvironmentKVEditor = forwardRef<EnvironmentEditorHandle, EditorProps>(({
  data,
  onChange,
}, ref) => {
  const kvPairs: EnvironmentKvPairData[] = data.length > 0 ? [...data] : [createNewPair()];
  const parentRef = useRef<HTMLDivElement>(null);

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
      // enable item since user modifies the item unless manual disbale it
      kvPairs[changedItemIdx]['enabled'] = true;
      kvPairs[changedItemIdx][changedPropertyName] = newValue;
    }
    onChange(kvPairs);
  };

  const handleAddItem = (id: string) => {
    const newPair = createNewPair();
    const insertIdx = kvPairs.findIndex(d => d.id === id);
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

  const renderPairItem = (kvPair: EnvironmentKvPairData) => {
    const { id, name, value, type, enabled = false } = kvPair;
    const isValidJSONString = checkValidJSONString(value);
    return (
      <>
        <div className={`${cellCommonStyle} p-0 w-20 flex flex-shrink-0 items-center justify-end`}>
          <Icon icon="grip-vertical" className="cursor-grab hidden mr-1 group-hover:inline" />
          <Button
            className="flex items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={() => handleAddItem(id)}
          >
            <Icon icon="plus" />
          </Button>
          <ToggleButton
            className="flex items-center justify-center h-7 aspect-square rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onChange={isSelect => handleItemChange(id, 'enabled', isSelect)}
            isSelected={enabled}
          >
            <Icon icon={enabled ? 'check-square' : 'square'} />
          </ToggleButton>
        </div>
        <div className={`${cellCommonStyle} w-[25%] flex flex-grow`}>
          <OneLineEditor
            id={`environment-kv-editor-name-${id}`}
            placeholder={'Input Name'}
            defaultValue={name}
            onChange={newName => handleItemChange(id, 'name', newName)}
          />
        </div>
        <div className={`${cellCommonStyle} w-32`}>
          <Select
            selectedKey={type}
            aria-label='environment-kv-editor-type-selector'
            className='w-full'
            onSelectionChange={newType => {
              handleItemChange(id, 'type', newType as EnvironmentKvPairDataType);
            }}
            disabledKeys={isValidJSONString ? [] : [EnvironmentKvPairDataType.JSON]}
          >
            <Button className="py-1 px-[--padding-sm] w-full font-bold flex flex-1 items-center justify-between aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] text-sm">
              <SelectValue className="flex truncate items-center justify-center gap-2" />
              <Icon icon="caret-down" />
            </Button>
            <Popover className='border-solid border-[--hl-sm] shadow-lg bg-[--color-bg]'>
              <ListBox
                items={
                  [
                    {
                      id: EnvironmentKvPairDataType.STRING,
                      name: 'String',
                    },
                    {
                      id: EnvironmentKvPairDataType.JSON,
                      name: 'JSON',
                    },
                  ]
                }
              >
                {item => (
                  <ListBoxItem
                    className="aria-disabled:text-[--hl-lg] aria-disabled:cursor-not-allowed aria-disabled:bg-transparent flex gap-2 pl-[--padding-sm] pr-[--padding-xl] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors text-sm react-aria-ListBoxItem"
                    aria-label={item.name}
                    textValue={item.name}
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
                  </ListBoxItem>
                )}
              </ListBox>
            </Popover>
          </Select>
        </div>
        <div className={`${cellCommonStyle} w-[50%]`}>
          {type === EnvironmentKvPairDataType.STRING ?
            <div className="h-full w-full flex flex-1 px-2">
              <OneLineEditor
                id={`environment-kv-editor-value-${id}`}
                placeholder={'Input Value'}
                defaultValue={value.toString()}
                onChange={newValue => handleItemChange(id, 'value', newValue)}
              />
            </div> :
            <CodeEditor
              id={`environment-kv-editor-value-${id}`}
              className="w-full h-full py-1 editor--environment-inline"
              defaultValue={value}
              enableNunjucks
              mode="application/json"
              dynamicHeight={false}
              onChange={value => {
                if (checkValidJSONString(value)) {
                  const err = checkNestedKeys(JSON.parse(value));
                  if (err) {
                    // handle error
                  } else {
                    handleItemChange(id, 'value', value);
                  }
                }
              }}
            />
          }
        </div>
        <div className={`${cellCommonStyle} w-14`}>
          <PromptButton
            disabled={kvPairs.length <= 1}
            className="flex	items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            fullWidth
            confirmMessage=''
            doneMessage=''
            onClick={() => handleDeleteItem(id)}
          >
            <Icon icon="trash-can" />
          </PromptButton>
        </div>
      </>
    );
  };

  return (
    <div className="p-[--padding-sm] min-w-max h-full overflow-hidden flex flex-col">
      <div className="min-w-full flex h-[--line-height-xxs]">
        <span className={`${headerStyle} w-20 flex-shrink-0`} />
        <span className={`${headerStyle} w-[25%] flex flex-grow`}>Name</span>
        <span className={`${headerStyle} w-32`}>Type</span>
        <span className={`${headerStyle} w-[50%]`}>Value</span>
        <span className={`${headerStyle} w-14`}>Action</span>
      </div>
      <ListBox
        aria-label='Environment Key Value Pair'
        selectionMode='none'
        dragAndDropHooks={dragAndDropHooks}
        className="w-full overflow-y-auto py-1 scroll-pr-3"
        items={kvPairs}
        ref={parentRef}
      >
        {kvPair => {
          const { id, type } = kvPair;
          return (
            <ListBoxItem
              key={id}
              id={id}
              className={`w-full flex group focus:outline-none ${type === 'json' ? 'h-[--line-height-lg]' : 'h-[--line-height-sm]'}`}
            >
              {renderPairItem(kvPair)}
            </ListBoxItem>
          );
        }}
      </ListBox>
    </div>
  );
});
EnvironmentKVEditor.displayName = 'EnvironmentKeyValueEditor';
