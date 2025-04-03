import React from 'react';
import { Button, ComboBox, Group, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';

import { fuzzyMatch } from '../../common/misc';
import { Icon } from './icon';

const BUILT_IN_ENCODINGS = [
  { key: 'UTF-8', label: 'UTF-8' },
  { key: 'UTF-16LE', label: 'UTF-16 LE' },
  { key: 'UTF-16BE', label: 'UTF-16 BE' },
  { key: 'UTF-32LE', label: 'UTF-32 LE' },
  { key: 'UTF-32BE', label: 'UTF-32 BE' },
  { key: 'ASCII', label: 'ASCII' },
  { key: 'ISO-8859-1', label: 'Western European (Latin-1)' },
  { key: 'ISO-8859-2', label: 'Central European (Latin-2)' },
  { key: 'ISO-8859-3', label: 'South European (Latin-3)' },
  { key: 'ISO-8859-4', label: 'North European (Latin-4)' },
  { key: 'ISO-8859-5', label: 'Cyrillic' },
  { key: 'ISO-8859-6', label: 'Arabic' },
  { key: 'ISO-8859-7', label: 'Greek' },
  { key: 'ISO-8859-8', label: 'Hebrew' },
  { key: 'ISO-8859-9', label: 'Turkish (Latin-5)' },
  { key: 'ISO-8859-10', label: 'Nordic (Latin-6)' },
  { key: 'ISO-8859-11', label: 'Thai' },
  { key: 'ISO-8859-12', label: 'Ethiopic' },
  { key: 'ISO-8859-13', label: 'Baltic (Latin-7)' },
  { key: 'ISO-8859-14', label: 'Celtic (Latin-8)' },
  { key: 'ISO-8859-15', label: 'Western European (Latin-9)' },
  { key: 'ISO-8859-16', label: 'Southeastern European (Latin-10)' },
  { key: 'windows-1250', label: 'Windows-1250' },
  { key: 'windows-1251', label: 'Windows-1251' },
  { key: 'windows-1252', label: 'Windows-1252' },
  { key: 'windows-1253', label: 'Windows-1253' },
  { key: 'windows-1254', label: 'Windows-1254' },
  { key: 'windows-1255', label: 'Windows-1255' },
  { key: 'windows-1256', label: 'Windows-1256' },
  { key: 'windows-1257', label: 'Windows-1257' },
  { key: 'windows-1258', label: 'Windows-1258' },
  { key: 'GB18030', label: 'GB 18030' },
  { key: 'EUC-JP', label: 'EUC-JP' },
  { key: 'EUC-KR', label: 'EUC-KR' },
  { key: 'EUC-CN', label: 'EUC-CN' },
  { key: 'Big5', label: 'Big5' },
  { key: 'Shift_JIS', label: 'Shift_JIS' },
  { key: 'KOI8-R', label: 'KOI8-R' },
  { key: 'KOI8-U', label: 'KOI8-U' },
  { key: 'KOI8-RU', label: 'KOI8-RU' },
  { key: 'KOI8-T', label: 'KOI8-T' },
];

export const EncodingPicker = ({ encoding, onChange }: { encoding: string; onChange: (value: string) => void }) => {
  return (
    <ComboBox
      aria-label='Encoding Selector'
      className='inline-block'
      selectedKey={encoding}
      onSelectionChange={key => {
        if (key) {
          onChange(key as string);
        }
      }}
      defaultFilter={(textValue, filter) => {
        const encodingKey = BUILT_IN_ENCODINGS.find(e => e.label === textValue)?.key || '';
        return Boolean(fuzzyMatch(
          filter,
          encodingKey,
          { splitSpace: false, loose: true }
        )?.indexes) || textValue.toLowerCase().includes(filter.toLowerCase());
      }}
    >
      <Group className='flex border-solid border border-[--hl-sm] w-full pr-2 min-w-64'>
        <Input className='flex-1 py-1 px-2'/>
        <Button className="flex items-center transition-all bg-transparent">
         <Icon icon="caret-down" />
        </Button>
      </Group>
      <Popover className="overflow-y-hidden flex flex-col">
        <ListBox
          className="border select-none text-sm max-h-80 border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-1 rounded-md overflow-y-auto focus:outline-none"
          items={BUILT_IN_ENCODINGS}
          aria-label="Encoding List"
          autoFocus
        >
          {item => (
            <ListBoxItem
              aria-label={item.label}
              textValue={item.label}
              className="aria-disabled:opacity-30 rounded aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] data-[focused]:bg-[--hl-xs] focus:outline-none transition-colors"
            >
              {({ isSelected }) => (
                <>
                  <span>{item.label}</span>
                  {isSelected && (
                    <Icon
                      icon="check"
                      className="ml-1 text-[--color-success] justify-self-end"
                    />
                  )}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
};
