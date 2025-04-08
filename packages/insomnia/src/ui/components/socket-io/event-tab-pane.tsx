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
    return eventListeners?.length > 0
      ? eventListeners
      : [createEmptyListener()];
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
    <div className='p-4'>
      <div className='grid grid-cols-[30px_1fr_80px_1fr_50px] items-center gap-2 border-solid border border-[--hl-md]'>
        <div />
        <div className='flex items-center'>
          EVENTS
          <Button className="w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center ml-1" onPress={handleAddEvent}>
            <Icon icon="plus" className='cursor-pointer' />
          </Button>
        </div>
        <div className='border-solid border-r border-[--hl-md] h-full'>LISTEN</div>
        <div>DESCRIPTION</div>
        <div />
      </div>
      <GridList
        onSelectionChange={() => { }}
        aria-label='SocketIO Events'
        items={rows}
      >
        {item => (
          <GridListItem
            className="group h-[30px] grid grid-cols-[30px_1fr_80px_1fr_50px] items-center gap-2 border-solid border-b border-x border-[--hl-md] [&:hover_.deleteBtn]:flex transition-all"
            textValue='event item'
          >
            <div />
            <OneLineEditor
              defaultValue={item.eventName}
              id={`socketIO-event-listener-${item.id}`}
              placeholder='Add event'
              onChange={eventName => {
                handleChange({ ...item, eventName }, 'eventName');
              }}
            />
            <div className='border-solid border-r border-[--hl-md] text-left h-full'>
              <Switch
                isSelected={item.isOpen}
                onChange={isOpen => {
                  handleChange({ ...item, isOpen }, 'isOpen');
                }}
                className="cursor-pointer p-0 h-full flex items-center"
              >
                {({ isSelected }) => {
                  return (
                    <div
                      className={classNames("w-[30px] h-4.5 border-solid border-[1px] border-[--hl] bg-[--color-bg] rounded-full transition-all duration-200 before:content-[''] before:block before:m-0.5 before:w-3.5 before:h-3.5 before:rounded-full before:transition-all before:duration-200", {
                        'bg-[--color-surprise] before:bg-[--color-bg] before:translate-x-[100%]': isSelected,
                        'before:bg-[--color-surprise]': !isSelected,
                      })}
                    />
                  );
                }}
              </Switch>
            </div>
            <OneLineEditor
              defaultValue={item.desc}
              id={`socketIO-event-listener-desc-${item.id}`}
              onChange={desc => {
                handleChange({ ...item, desc }, 'desc');
              }}
            />
            <div>
              <Button className="hidden deleteBtn w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center" onPress={() => handleDeleteEvent(item)}>
                <Icon icon="trash" className='cursor-pointer' />
              </Button>
            </div>
          </GridListItem >
        )}
      </GridList >
    </div >
  );
};
