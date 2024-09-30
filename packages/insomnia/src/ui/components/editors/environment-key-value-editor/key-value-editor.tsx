import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Button, Cell, Column, ListBox, ListBoxItem, Popover, Row, Select, SelectValue, Table, TableBody, TableHeader, ToggleButton } from 'react-aria-components';

import { generateId } from '../../../../common/misc';
import { type EnvironmentKvPairData, EnvironmentKvPairDataType } from '../../../../models/environment';
import { PromptButton } from '../../base/prompt-button';
import { CodeEditor } from '../../codemirror/code-editor';
import { OneLineEditor } from '../../codemirror/one-line-editor';
import { Icon } from '../../icon';
import type { EnvironmentEditorHandle } from '../environment-editor';

interface EditorProps {
  data: EnvironmentKvPairData[];
  onChange: (newPari: EnvironmentKvPairData[]) => void;
}
const rowHeaderStyle = 'sticky normal-case top-[-8px] p-2 z-10 border-b border-r border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none';
const cellCommonStyle = 'px-2 border-b border-r border-solid border-[--hl-sm] h-8 align-middle';

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

  const handleItemChange = <K extends keyof EnvironmentKvPairData>(id: string, changedPropertyName: K, newValue: EnvironmentKvPairData[K]) => {
    const changedItemIdx = kvPairs.findIndex(p => p.id === id);
    if (changedItemIdx !== -1) {
      kvPairs[changedItemIdx][changedPropertyName] = newValue;
      // also enable item since user modifies the item
      kvPairs[changedItemIdx]['enabled'] = true;
    }
    onChange(kvPairs);
  };

  const handleAddItem = (insertIdx: number) => {
    const newPair = createNewPair();
    kvPairs.splice(insertIdx, 0, newPair);
    onChange(kvPairs);
  };

  const handleDeleteItem = (id: string) => {
    const filteredPairs = kvPairs.filter(d => d.id !== id);
    onChange(filteredPairs);
  };

  return (
    <div className="p-[--padding-sm]">
      <Table
        aria-label='Environment Variable Table'
        className="min-w-full table-auto"
      >
        <TableHeader>
          <Column className={rowHeaderStyle} />
          <Column className={rowHeaderStyle} isRowHeader>Name</Column>
          <Column className={rowHeaderStyle}>Type</Column>
          <Column className={rowHeaderStyle}>Value</Column>
          <Column className={rowHeaderStyle}>Action</Column>
        </TableHeader>
        <TableBody>
          {kvPairs.map((kvPair, idx) => {
            const { id, name, value, type, enabled = false } = kvPair;
            return (
              <Row key={id} className="h-[--line-height-sm] group">
                <Cell className={`${cellCommonStyle} p-0 w-[50px]`}>
                  <div className="flex flex-row flex-1 items-center justify-end">
                    {/* <Icon icon="grip-vertical" className="cursor-grab hidden mr-1 group-hover:inline" /> */}
                    <Button
                      className="flex items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={() => handleAddItem(idx + 1)}
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
                </Cell>
                <Cell className={`${cellCommonStyle} w-[25%]`}>
                  <div className="h-full w-full flex">
                    <OneLineEditor
                      id={`environment-kv-editor-name-${id}`}
                      placeholder={'Input Name'}
                      defaultValue={name}
                      onChange={newName => handleItemChange(id, 'name', newName)}
                    />
                  </div>
                </Cell>
                <Cell className={`${cellCommonStyle} min-w-8`}>
                  <Select
                    selectedKey={type}
                    aria-label='environment-kv-editor-type-selector'
                    onSelectionChange={newType => {
                      handleItemChange(id, 'type', newType as EnvironmentKvPairDataType);
                    }}
                  >
                    <Button className="py-1 px-[--padding-md] w-full font-bold flex flex-1 items-center justify-between aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs]  text-sm">
                      <SelectValue className="flex truncate items-center justify-center gap-2" />
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover className='border-solid border-[--hl-sm] shadow-lg bg-[--color-bg]'>
                      <ListBox
                        items={
                          [
                            {
                              id: EnvironmentKvPairDataType.STRING,
                              name: 'string',
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
                            className="flex gap-2 pl-[--padding-md] pr-[--padding-xl] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors text-sm"
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
                </Cell>
                <Cell className={`${cellCommonStyle} w-[50%]`}>
                  <div className="relative h-full w-full flex flex-1 px-2">
                    {type === EnvironmentKvPairDataType.STRING ?
                      <OneLineEditor
                        id={`environment-kv-editor-value-${id}`}
                        placeholder={'Input Value'}
                        defaultValue={value.toString()}
                        onChange={newValue => handleItemChange(id, 'value', newValue)}
                      /> :
                      <CodeEditor
                        id={`environment-kv-editor-value-${id}`}
                        placeholder={'Input Value'}
                        defaultValue={value}
                        onChange={() => { }}
                      />
                    }
                  </div>
                </Cell>
                <Cell className={`${cellCommonStyle} w-5`}>
                  <div className="flex flex-row gap-2">
                    <PromptButton
                      disabled={kvPairs.length <= 1 && idx === 0}
                      className="flex	items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      confirmMessage=''
                      doneMessage=''
                      onClick={() => handleDeleteItem(id)}
                    >
                      <Icon icon="trash-can" />
                    </PromptButton>
                  </div>
                </Cell>
              </Row>
            );
          })}
        </TableBody>
      </Table>
    </div>

  );
});
EnvironmentKVEditor.displayName = 'EnvironmentKeyValueEditor';
