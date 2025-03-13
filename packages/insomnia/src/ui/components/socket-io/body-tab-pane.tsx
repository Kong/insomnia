import React, { useMemo, useRef } from 'react';
import { Button, Checkbox, Collection, Input, ListBox, ListBoxItem, Popover, Select, SelectValue, Tab, TabList, TabPanel, Tabs, Toolbar } from 'react-aria-components';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import { CodeEditor, type CodeEditorHandle } from '../codemirror/code-editor';
import { Icon } from '../icon';

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

export const SocketIOBodyTabPane = ({ }) => {
  const readyState = 1;
  const selectedContentType = CONTENT_TYPE_JSON;
  const ack = true;
  const eventName = 'eventName';

  const handleAddArg = () => { };

  const args = [1, 2];

  const editorRef = useRef<CodeEditorHandle>(null);

  const tabs = useMemo(() => {
    return args.map((item, index) => {
      return {
        title: `Arg ${index + 1}`,
        content: item,
      };
    });
  }, [args]);
  return (
    <>
      <Toolbar className="w-full flex-shrink-0 px-2 border-b border-solid border-[--hl-md] py-2 h-[--line-height-sm] flex items-center gap-2 justify-between">
        <div className='flex items-center justify-between gap-2'>
          <Button onPress={handleAddArg} className="p-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">+ Arg</Button>
          <Select
            aria-label="Change Body Type"
            name="body-type"
            onSelectionChange={() => {}}
            selectedKey={selectedContentType}
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
        </div>
        <div className='flex items-center justify-between gap-2'>
          <Checkbox isSelected={ack} onChange={() => {}} className="cursor-pointer group p-0 flex items-center h-full">
            Ack
            <div className="ml-2 w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
              <Icon icon={'check'} className='opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
            </div>
          </Checkbox>
          <Input
            required
            className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
            type="text"
            placeholder="event name"
            value={''}
          />
          <button
            className='hover:brightness-75'
            style={{
              padding: '0 var(--padding-md)',
              marginLeft: 'var(--padding-xs)',
              height: '100%',
              border: '1px solid var(--hl-lg)',
              borderRadius: 'var(--radius-md)',
              background: readyState ? 'var(--color-surprise)' : 'inherit',
              color: readyState ? 'var(--color-font-surprise)' : 'inherit',
            }}
          >
            Send
          </button>
        </div>
      </Toolbar>
      <Tabs orientation='vertical' className="flex flex-1">
        <TabList className="overflow-x-auto border-solid border-r border-r-[--hl-md] bg-[--color-bg] " aria-label="Dynamic tabs" items={tabs}>
          {arg => <Tab className="flex-shrink-0 flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300" id={arg.title}>{arg.title}</Tab>}
        </TabList>
        <Collection items={tabs}>
          {arg => (
            <TabPanel className="flex-1" id={arg.title}>
              <CodeEditor
                id="socket-io-message-editor"
                showPrettifyButton
                // TODO: Add uniqueness key
                uniquenessKey={''}
                mode={selectedContentType}
                ref={editorRef}
                onChange={() => {}}
                enableNunjucks
                className="w-full"
              />
            </TabPanel>
          )}
        </Collection>
      </Tabs>
    </>
  );
};
