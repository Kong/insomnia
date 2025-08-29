import React, { useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Collection,
  Input,
  type Key,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TextField,
  Toolbar,
} from 'react-aria-components';
import { v4 as uuidv4 } from 'uuid';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { CONTENT_TYPE_JSON, CONTENT_TYPE_PLAINTEXT } from '../../../common/constants';
import type { SocketIOPayload } from '../../../models/socket-io-payload';
import type { SocketIORequest } from '../../../models/socket-io-request';
import { tryToInterpolateRequestOrShowRenderErrorModal } from '../../../utils/try-interpolate';
import { useRequestPayloadPatcher } from '../../hooks/use-request';
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
  environmentId: string;
}

export const SocketIOBodyTabPane = ({ request, requestPayload, environmentId }: Props) => {
  const [selectedArg, setSelectedArg] = useState<Key>('');
  const requestPayloadPatcher = useRequestPayloadPatcher();

  const handleAddArg = async () => {
    const args = requestPayload?.args || [];
    const newId = uuidv4();
    const newArgs = [...args, { id: newId, value: '', mode: CONTENT_TYPE_PLAINTEXT }];
    await requestPayloadPatcher(request._id, { args: newArgs });
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

  const handleDelete = async (id: string) => {
    const newArgs = requestPayload?.args?.filter(arg => arg.id !== id);
    await requestPayloadPatcher(request._id, { args: newArgs });
    setSelectedArg(newArgs?.[newArgs.length - 1]?.id);
  };

  const handleSend = async () => {
    const renderedArgs = await tryToInterpolateRequestOrShowRenderErrorModal({
      request,
      environmentId,
      payload: requestPayload?.args.map(item => item.value),
    });

    window.main.socketIO.event.send({
      requestId: request._id,
      eventName: requestPayload?.eventName || 'message',
      ack: requestPayload?.ack,
      args: renderedArgs,
    });
  };

  return (
    <>
      <Toolbar className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center justify-between gap-2 border-b border-solid border-[--hl-md] px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          <Button
            onPress={handleAddArg}
            className="p-1 ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md]"
          >
            + Arg
          </Button>
          <Select
            aria-label="Change Body Type"
            name="body-type"
            onSelectionChange={value => handleContentTypeChange(value.toString())}
            selectedKey={contentType}
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
                    className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
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
        </div>
        <div className="flex items-center justify-between gap-2">
          <Checkbox
            isSelected={requestPayload?.ack}
            onChange={value => requestPayloadPatcher(request._id, { ack: value })}
            className="group flex h-full cursor-pointer items-center p-0"
          >
            <div className="mr-2 flex h-4 w-4 items-center justify-center rounded ring-1 ring-[--hl-sm] transition-colors group-focus:ring-2 group-data-[selected]:bg-[--hl-xs]">
              <Icon
                icon={'check'}
                className="h-3 w-3 opacity-0 group-data-[selected]:text-[--color-success] group-data-[indeterminate]:opacity-100 group-data-[selected]:opacity-100"
              />
            </div>
            Ack
          </Checkbox>
          <TextField
            aria-label="Event Name"
            defaultValue={requestPayload?.eventName || ''}
            onChange={value => requestPayloadPatcher(request._id, { eventName: value })}
            className="col-span-3 h-8 w-full flex-1 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic placeholder:opacity-60 focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
          >
            <Input type="text" placeholder="event name" />
          </TextField>
          <Button
            onPress={handleSend}
            className="rounded bg-[--color-surprise] px-[--padding-md] text-center text-[--color-font-surprise]"
          >
            Send
          </Button>
        </div>
      </Toolbar>
      <SocketIOBodyContent
        args={requestPayload?.args || []}
        readonly={false}
        handleDelete={handleDelete}
        handleChange={handleChange}
        selectedArg={selectedArg}
        setSelectedArg={setSelectedArg}
      />
    </>
  );
};

interface BodyContentProps {
  args: SocketIOPayload['args'];
  readonly: boolean;
  handleDelete?: (id: string) => void;
  handleChange?: (id: string, value: string) => void;
  selectedArg?: Key;
  setSelectedArg?: (key: Key) => void;
  filter?: string;
  updateFilter?: (filter: string) => void;
  filterHistory?: string[];
}
export const SocketIOBodyContent = ({
  args,
  readonly,
  handleDelete,
  handleChange,
  selectedArg,
  setSelectedArg,
  filter,
  updateFilter,
  filterHistory,
}: BodyContentProps) => {
  const editorsRef = useRef(new Map());
  const tabs = useMemo(() => {
    return args.map((item, index) => {
      return {
        title: `Arg ${index + 1}`,
        ...item,
      };
    });
  }, [args]);

  return (
    <div className="h-full">
      {tabs.length > 1 ? (
        <Tabs
          selectedKey={selectedArg}
          onSelectionChange={setSelectedArg}
          orientation="vertical"
          className="flex h-full flex-1"
        >
          <TabList
            className="overflow-x-auto border-r border-solid border-r-[--hl-md] bg-[--color-bg]"
            aria-label="Dynamic tabs"
            items={tabs}
          >
            {arg => (
              <Tab
                className="relative flex flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-6 py-2 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                id={arg.id}
              >
                {({ isHovered }) => (
                  <>
                    {!readonly && (
                      <Button
                        onPress={() => {
                          handleDelete?.(arg.id);
                        }}
                        className={`absolute right-0 top-0 h-4 w-4 hover:bg-[--hl-lg] ${!isHovered && 'hidden'}`}
                      >
                        <Icon icon="close" className="h-4 w-4 align-top" />
                      </Button>
                    )}
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
                  showPrettifyButton={!readonly}
                  uniquenessKey={`${arg.id}:socket-io-payload`}
                  mode={arg.mode}
                  readOnly={readonly}
                  ref={ref => editorsRef.current?.set(arg.id, ref)}
                  onChange={readonly ? undefined : value => handleChange?.(arg.id, value)}
                  enableNunjucks
                  className="w-full"
                  defaultValue={arg.value}
                  updateFilter={updateFilter}
                  filterHistory={filterHistory}
                  filter={filter}
                  autoPrettify
                />
              </TabPanel>
            )}
          </Collection>
        </Tabs>
      ) : (
        <CodeEditor
          id="socket-io-message-editor"
          showPrettifyButton={!readonly}
          uniquenessKey={`${tabs?.[0]?.id}:socket-io-payload`}
          mode={tabs?.[0]?.mode}
          readOnly={readonly}
          ref={ref => editorsRef.current?.set(tabs?.[0]?.id, ref)}
          onChange={readonly ? undefined : value => handleChange?.(tabs?.[0]?.id, value)}
          enableNunjucks
          className="w-full"
          defaultValue={tabs?.[0]?.value}
          updateFilter={updateFilter}
          filterHistory={filterHistory}
          filter={filter}
          autoPrettify
        />
      )}
    </div>
  );
};
