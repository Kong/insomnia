import React, { useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Collection, Input, type Key, ListBox, ListBoxItem, Popover, Select, SelectValue, Tab, TabList, TabPanel, Tabs, TextField, Toolbar } from 'react-aria-components';
import { v4 as uuidv4 } from 'uuid';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import type { SocketIOPayload } from '../../../models/socket-io-payload';
import type { SocketIORequest } from '../../../models/socket-io-request';
import { useRequestPayloadPatcher } from '../../hooks/use-request';
import { CodeEditor } from '../codemirror/code-editor';
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
      name: 'Text',
    },
  ];

interface Props {
  request: SocketIORequest;
  requestPayload: SocketIOPayload;
}

export const SocketIOBodyTabPane = ({
  request,
  requestPayload,
}: Props) => {
  const editorsRef = useRef(new Map());

  const [selectedArg, setSelectedArg] = useState<Key>('');
  const requestPayloadPatcher = useRequestPayloadPatcher();
  // console.log('args', args);

  const handleAddArg = async () => {
    const args = requestPayload?.args || [];
    const newId = uuidv4();
    console.log('newId', newId);
    const newArgs = [...args, { id: newId, value: '', mode: CONTENT_TYPE_PLAINTEXT }];
    requestPayloadPatcher(request._id, { args: newArgs });
    setSelectedArg(newId);
  };

  const handleChange = async (id: string, value: string) => {
    const args = requestPayload?.args || [];
    const newArgs = [...args];
    const item = newArgs.find(arg => arg.id === id);
    if (item) {
      item.value = value;
      requestPayloadPatcher(request._id, { args: newArgs });
    }
  };

  const tabs = useMemo(() => {
    const args = requestPayload?.args || [];
    return args.map((item, index) => {
      return {
        title: `Arg ${index + 1}`,
        ...item,
      };
    });
  }, [requestPayload]);

  const contentType = useMemo(() => {
    const args = requestPayload?.args || [];
    if (args.length <= 1) {
      return args[0]?.mode || CONTENT_TYPE_JSON;
    }
    const item = args.find(arg => arg.id === selectedArg);
    return item?.mode || CONTENT_TYPE_JSON;

  }, [requestPayload?.args, selectedArg]);

  const handleContentTypeChange = (value: string) => {
    const currentArgId = selectedArg || requestPayload?.args?.[0]?.id;
    const newArgs = requestPayload?.args?.map(arg => {
      if (arg.id === currentArgId) {
        return { ...arg, mode: value };
      }
      return arg;
    });
    requestPayloadPatcher(request._id, { args: newArgs });
  };

  const handleDelete = (id: string) => {
    const newArgs = requestPayload?.args?.filter(arg => arg.id !== id);
    requestPayloadPatcher(request._id, { args: newArgs });
  };

  const handleSend = () => {
    // TODO handle JSON
    window.main.socketIO.event.send({
      requestId: request._id,
      eventName: requestPayload?.eventName || 'message',
      ack: requestPayload?.ack,
      args: requestPayload?.args.map(item => item.value),
    });
  };

  return (
    <>
      <Toolbar className="w-full flex-shrink-0 px-2 border-b border-solid border-[--hl-md] py-2 h-[--line-height-sm] flex items-center gap-2 justify-between">
        <div className='flex items-center justify-between gap-2'>
          <Button onPress={handleAddArg} className="p-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">+ Arg</Button>
          <Select
            aria-label="Change Body Type"
            name="body-type"
            onSelectionChange={value => handleContentTypeChange(value.toString())}
            selectedKey={contentType}
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
          <Checkbox
            isSelected={requestPayload?.ack}
            onChange={value => requestPayloadPatcher(request._id, { ack: value })}
            className="cursor-pointer group p-0 flex items-center h-full"
          >
            <div className="mr-2 w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
              <Icon icon={'check'} className='opacity-0 group-data-[selected]:opacity-100 group-data-[indeterminate]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
            </div>
            Ack
          </Checkbox>
          <TextField
            aria-label='Event Name'
            value={requestPayload?.eventName || ''}
            onChange={value => requestPayloadPatcher(request._id, { eventName: value })}
            className='py-1 h-8 w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors flex-1 placeholder:italic placeholder:opacity-60 col-span-3'
          >
            <Input
              type="text"
              placeholder="event name"
            />
          </TextField>
          <Button onPress={handleSend} className='text-center bg-[--color-surprise] text-[--color-font-surprise] rounded px-[--padding-md]'>Send</Button>
        </div>
      </Toolbar>
      {tabs.length > 1 ? (
        <Tabs selectedKey={selectedArg} onSelectionChange={setSelectedArg} orientation='vertical' className="flex flex-1" >
          <TabList className="overflow-x-auto border-solid border-r border-r-[--hl-md] bg-[--color-bg] " aria-label="Dynamic tabs" items={tabs}>
            {arg => (
              <Tab
                className="relative flex-shrink-0 flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-6 py-2 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300"
                id={arg.id}
              >
                {({ isHovered }) => (
                  <>
                    <Button
                      onPress={() => handleDelete(arg.id)}
                      className={`w-4 h-4 absolute right-0 top-0 hover:bg-[--hl-lg] ${!isHovered && 'hidden'}`}
                    >
                      <Icon icon="close" className='w-4 h-4 align-top' />
                    </Button>
                    {arg.title}
                  </>
                )}
              </Tab>
            )}
          </TabList>
          <Collection items={tabs}>
            {arg => (
              <TabPanel className="flex-1" id={arg.id}>
                <CodeEditor
                  id="socket-io-message-editor"
                  showPrettifyButton
                  // TODO: Add uniqueness key
                  uniquenessKey={''}
                  mode={contentType}
                  ref={ref => editorsRef.current?.set(arg.id, ref)}
                  onChange={value => handleChange(arg.id, value)}
                  enableNunjucks
                  className="w-full"
                  defaultValue={arg.value}
                />
              </TabPanel>
            )}
          </Collection>
        </Tabs>
      ) : (
        <CodeEditor
          id="socket-io-message-editor"
          showPrettifyButton
          // TODO: Add uniqueness key
          uniquenessKey={''}
          mode={contentType}
          ref={ref => editorsRef.current?.set(tabs[0].id, ref)}
          onChange={value => handleChange(tabs[0].id, value)}
          enableNunjucks
          className="w-full"
          defaultValue={tabs[0]?.value}
        />
      )}
    </>
  );
};
