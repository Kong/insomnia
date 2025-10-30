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
        contentType && onSelect(contentType.toString());
      }}
      selectedKey={previewMode}
    >
      <Button className="flex min-w-[12ch] flex-1 items-center justify-between gap-2 rounded-sm px-4 py-1 text-sm font-bold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]">
        <SelectValue<{ id: string; name: string }> className="flex items-center justify-center gap-2 truncate">
          {({ selectedText }) => <div className="flex items-center gap-2 text-[--hl]">{selectedText}</div>}
        </SelectValue>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="flex min-w-max flex-col overflow-y-hidden">
        <ListBox
          items={contentTypes}
          className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
        >
          {item => (
            <ListBoxItem
              className="flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
              aria-label={item.name}
              textValue={item.name}
            >
              {({ isSelected }) => (
                <>
                  <span>{item.name}</span>
                  {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
};
