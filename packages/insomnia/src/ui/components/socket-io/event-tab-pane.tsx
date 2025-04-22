import classNames from 'classnames';
import React, { useMemo } from 'react';
import { Button, GridList, GridListItem, Switch } from 'react-aria-components';

import { generateId } from '../../../common/misc';
import type { SocketIOEventListener, SocketIORequest } from '../../../models/socket-io-request';
import { useRequestPatcher } from '../../hooks/use-request';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { Icon } from '../icon';

interface Props {
  request: SocketIORequest;
  eventListeners: SocketIOEventListener[];
}

const createEmptyListener = () => {
  return {
    id: generateId('socketIO-event'),
    eventName: '',
    desc: '',
    isOpen: false,
  };
};

export const SocketIOEventTabPane = ({ request, eventListeners }: Props) => {
  const requestPatcher = useRequestPatcher();

  const rows = useMemo(() => {
    return eventListeners?.length > 0 ? eventListeners : [createEmptyListener()];
  }, [eventListeners]);

  const handleDeleteEvent = (deleteItem: SocketIOEventListener) => {
    const newListeners = eventListeners.filter(item => item.id !== deleteItem.id);
    requestPatcher(request._id, { eventListeners: newListeners });
    if (deleteItem.eventName && deleteItem.isOpen) {
      window.main.socketIO.event.off({
        requestId: request._id,
        eventName: deleteItem.eventName,
      });
    }
  };

  const handleAddEvent = () => {
    requestPatcher(request._id, { eventListeners: [...rows, createEmptyListener()] });
  };

  const handleChange = (newItem: SocketIOEventListener, changeKey: 'isOpen' | 'eventName' | 'desc') => {
    if (changeKey === 'isOpen' && newItem.eventName?.trim() === '') {
      // Socketio todo: focus input element
      return;
    }
    if (changeKey === 'eventName' && newItem.isOpen && newItem.eventName?.trim() === '') {
      newItem.isOpen = false;
    }
    const newListeners = rows.map(item => {
      if (item.id === newItem.id) {
        return newItem;
      }
      return item;
    });
    requestPatcher(request._id, { eventListeners: newListeners });

    if (changeKey === 'isOpen' && newItem.eventName) {
      if (newItem.isOpen) {
        window.main.socketIO.event.on({
          requestId: request._id,
          eventName: newItem.eventName,
        });
      } else {
        window.main.socketIO.event.off({
          requestId: request._id,
          eventName: newItem.eventName,
        });
      }
      return;
    }

    if (changeKey === 'eventName' && newItem.isOpen) {
      const originListener = rows.find(item => item.id === newItem.id);
      if (originListener) {
        window.main.socketIO.event.off({
          requestId: request._id,
          eventName: originListener.eventName,
        });
      }
      if (newItem.eventName !== '') {
        window.main.socketIO.event.on({
          requestId: request._id,
          eventName: newItem.eventName,
        });
      }
    }
  };

  return (
    <div className="p-4">
      <div className="grid h-[25px] grid-cols-[30px_1fr_80px_1px_1fr_50px] items-center gap-2 border border-solid border-[--hl-md]">
        <div />
        <div className="flex items-center">
          EVENTS
          <Button
            className="ml-1 flex h-[25px] w-[25px] items-center justify-center hover:bg-[--hl-xs]"
            onPress={handleAddEvent}
          >
            <Icon icon="plus" className="cursor-pointer" />
          </Button>
        </div>
        <div>LISTEN</div>
        <span className="h-full bg-[--hl-md]" />
        <div>DESCRIPTION</div>
        <div />
      </div>
      <GridList onSelectionChange={() => {}} aria-label="SocketIO Events" items={rows}>
        {item => (
          <GridListItem
            className="group grid h-[30px] grid-cols-[30px_1fr_80px_1px_1fr_50px] items-center gap-2 border-x border-b border-solid border-[--hl-md] transition-all [&:hover_.deleteBtn]:flex"
            textValue="event item"
          >
            <div />
            <OneLineEditor
              defaultValue={item.eventName}
              id={`socketIO-event-listener-${item.id}`}
              placeholder="Add event"
              onChange={eventName => {
                handleChange({ ...item, eventName }, 'eventName');
              }}
            />
            <div className="text-left">
              <Switch
                isSelected={item.isOpen}
                onChange={isOpen => {
                  handleChange({ ...item, isOpen }, 'isOpen');
                }}
                className="flex h-full cursor-pointer items-center p-0"
              >
                {({ isSelected }) => {
                  return (
                    <div
                      className={classNames(
                        "h-4.5 w-[30px] rounded-full border-[1px] border-solid border-[--hl] bg-[--color-bg] transition-all duration-200 before:m-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:transition-all before:duration-200 before:content-['']",
                        {
                          'bg-[--color-surprise] before:translate-x-[100%] before:bg-[--color-bg]': isSelected,
                          'before:bg-[--color-surprise]': !isSelected,
                        },
                      )}
                    />
                  );
                }}
              </Switch>
            </div>
            <span className="h-full bg-[--hl-md]" />
            <OneLineEditor
              defaultValue={item.desc}
              id={`socketIO-event-listener-desc-${item.id}`}
              onChange={desc => {
                handleChange({ ...item, desc }, 'desc');
              }}
            />
            <div>
              <Button
                className="deleteBtn flex hidden h-[25px] w-[25px] items-center justify-center hover:bg-[--hl-xs]"
                onPress={() => handleDeleteEvent(item)}
              >
                <Icon icon="trash" className="cursor-pointer" />
              </Button>
            </div>
          </GridListItem>
        )}
      </GridList>
    </div>
  );
};
