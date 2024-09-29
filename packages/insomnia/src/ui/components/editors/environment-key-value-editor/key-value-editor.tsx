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
  onChange?: (value: EnvironmentKvPairData) => void;
}

export const EnvironmentKVEditor = forwardRef<EnvironmentEditorHandle, EditorProps>(({
  data,
  onChange,
}, ref) => {
  const kvPairs: EnvironmentKvPairData[] = data.length > 0 ? data :
    [{ id: generateId('envPair'), name: '', value: '', type: EnvironmentKvPairDataType.STRING, enabled: false }];

  const handleItemChange = (id: string, changedPropertyName: keyof EnvironmentKvPairData, newValue: string) => {
    const changedItemIdx = kvPairs.findIndex(p => p.id === id);
    if (changedItemIdx !== -1) {

    }
  };

  return (
    <div className="environment-editor p-[--padding-sm]">
      <Table
        aria-label='Environment Variable Table'
        className="min-w-full table-auto"
      >
        <TableHeader>
          <Column />
          <Column isRowHeader>Name</Column>
          <Column>Type</Column>
          <Column>Value</Column>
          <Column>Action</Column>
        </TableHeader>
        <TableBody>
          {kvPairs.map(kvPair => {
            const { id, name, value, type, enabled = false } = kvPair;
            return (
              <Row key={id}>
                <Cell>
                  <div slot="drag" className="cursor-grab invisible p-2 w-5 flex focus-visible:bg-[--hl-sm] justify-center items-center flex-shrink-0">
                    <Button
                      className="flex items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={v => v}
                    >
                      <Icon icon="plus" />
                    </Button>
                    <Icon icon="grip-vertical" className='w-2 text-[--hl]' />
                  </div>
                </Cell>
                <Cell>
                  <div className="relative h-full w-full flex flex-1 px-2">
                    <OneLineEditor
                      id={`environment-kv-editor-name-${id}`}
                      placeholder={'Input Name'}
                      defaultValue={name}
                      onChange={() => { }}
                    />
                  </div>
                </Cell>
                <Cell>
                  <Select
                    selectedKey={type}
                  >
                    <Button className="px-4 min-w-[17ch] py-1 font-bold flex flex-1 items-center justify-between gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                      <SelectValue className="flex truncate items-center justify-center gap-2" />
                      <Icon icon="caret-down" />
                    </Button>
                    <Popover>
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
                            className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
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
                <Cell>
                  <div className="relative h-full w-full flex flex-1 px-2">
                    {type === EnvironmentKvPairDataType.STRING ?
                      <OneLineEditor
                        id={`environment-kv-editor-value-${id}`}
                        placeholder={'Input Name'}
                        defaultValue={value}
                        onChange={() => { }}
                      /> :
                      <CodeEditor
                        id={`environment-kv-editor-value-${id}`}
                        placeholder={'Input Name'}
                        defaultValue={value}
                        onChange={() => { }}
                      />
                    }
                  </div>
                </Cell>
                <Cell>
                  <div>
                    <ToggleButton
                      className="inline-block	items-center justify-center h-7 aspect-square rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onChange={v => v}
                      isSelected={enabled}
                    >
                      <Icon icon={enabled ? 'square' : 'check-square'} />
                    </ToggleButton>
                    <PromptButton
                      disabled={false}
                      className="inline-block	items-center disabled:opacity-50 justify-center h-7 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      confirmMessage=''
                      doneMessage=''
                      onClick={v => v}
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
