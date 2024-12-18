import React, { type FC } from 'react';
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import { Icon } from '../icon';

interface Props {
  previewMode: string;
  onSelect: (previewMode: string) => void;
}

const contentTypes: {
  id: string;
  name: string;
}[] = [
    {
      id: CONTENT_TYPE_JSON,
      name: 'JSON',
    },
    {
      id: CONTENT_TYPE_PLAINTEXT,
      name: 'Raw',
    },
  ];

export const WebSocketPreviewMode: FC<Props> = ({ previewMode, onSelect }) => {
  return (
    <Select
      aria-label="Change Body Type"
      name="body-type"
      onSelectionChange={contentType => {
        onSelect(contentType.toString());
      }}
      selectedKey={previewMode}
    >
      <Button className="px-4 min-w-[12ch] py-1 font-bold flex flex-1 items-center justify-between gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <SelectValue<{ id: string; name: string }>
          className="flex truncate items-center justify-center gap-2"
        >
          {({ selectedText }) => (
            <div className='flex items-center gap-2 text-[--hl]'>
              {selectedText}
            </div>
          )}
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="min-w-max overflow-y-hidden flex flex-col">
        <ListBox
          items={contentTypes}
          className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
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
  );
};
