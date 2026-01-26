import classNames from 'classnames';
import React, { useMemo } from 'react';
import { Button, GridList, GridListItem, Input, Switch } from 'react-aria-components';

import { generateId } from '../../../common/misc';
import type { SocketIOEventListener, SocketIORequest } from '../../../models/socket-io-request';
import { useRequestPatcher } from '../../hooks/use-request';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';

interface Props {
  request: SocketIORequest;
  eventListeners: SocketIOEventListener[];
}

interface InputProps {
  value?: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  warning?: string;
  className?: string;
  placeholder?: string;
}
const InputComponent = ({ value, defaultValue, onChange, warning, className, ...props }: InputProps) => {
  return (
    <div className={`${className} flex w-full`}>
      <Input
        className="w-full"
        value={value}
        defaultValue={defaultValue}
        onChange={e => onChange(e?.target?.value)}
        {...props}
      />
      {warning && (
        <Tooltip message={warning} position="bottom" delay={500}>
          <Icon icon="warning" className="text-(--color-warning)" />
        </Tooltip>
      )}
    </div>
  );
};

const createEmptyListener = () => {
  return {
    id: generateId('socketIO-event'),
    eventName: '',
    desc: '',
    isOpen: false,
  };
};

interface UIEventListener extends SocketIOEventListener {
  disabled?: boolean;
  warning?: string;
}

export const SocketIOEventTabPane = ({ request, eventListeners }: Props) => {
  const requestPatcher = useRequestPatcher();

  const updateRequest = (eventListeners: UIEventListener[]) => {
    const arr = eventListeners.map(item => ({
      id: item.id,
      eventName: item.eventName,
      desc: item.desc,
      isOpen: item.isOpen,
    }));
    requestPatcher(request._id, {
      eventListeners: arr,
    });
  };

  const rows = useMemo<UIEventListener[]>(() => {
    const listeners = eventListeners?.length > 0 ? eventListeners : [createEmptyListener()];
    const map = new Map<string, number>();
    return listeners.map(item => {
      const count = map.get(item.eventName) || 0;
      let disabled = false;
      let warning = '';
      if (count !== 0) {
        disabled = true;
        warning = 'eventname must be unique';
      }
      map.set(item.eventName, count + 1);
      return { ...item, disabled, warning };
    });
  }, [eventListeners]);

  const handleDeleteEvent = (deleteItem: SocketIOEventListener) => {
    const newListeners = eventListeners.filter(item => item.id !== deleteItem.id);
    updateRequest(newListeners);
    if (deleteItem.eventName && deleteItem.isOpen) {
      window.main.socketIO.event.off({
        requestId: request._id,
        eventName: deleteItem.eventName,
      });
    }
  };

  const handleAddEvent = () => {
    updateRequest([...rows, createEmptyListener()]);
  };

  const handleChange = (newItem: UIEventListener, changeKey: 'isOpen' | 'eventName' | 'desc') => {
    if (changeKey === 'isOpen' && newItem.eventName?.trim() === '') {
      // Socketio todo: focus input element
      return;
    }
    // off event when edit eventName
    if (changeKey === 'eventName' && newItem.isOpen) {
      newItem.isOpen = false;
      const originListener = rows.find(item => item.id === newItem.id);
      if (originListener?.eventName) {
        window.main.socketIO.event.off({
          requestId: request._id,
          eventName: originListener.eventName,
        });
      }
    }

    const newListeners = rows.map(item => {
      if (item.id === newItem.id) {
        return newItem;
      }
      return item;
    });
    updateRequest(newListeners);

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
    }
  };

  return (
    <div className="p-4">
      <div className="grid h-[25px] grid-cols-[30px_1fr_80px_1px_1fr_50px] items-center gap-2 border border-solid border-(--hl-md)">
        <div />
        <div className="flex items-center">
          EVENTS
          <Button
            className="ml-1 flex h-[25px] w-[25px] items-center justify-center hover:bg-(--hl-xs)"
            onPress={handleAddEvent}
          >
            <Icon icon="plus" className="cursor-pointer" />
          </Button>
        </div>
        <div>LISTEN</div>
        <span className="h-full bg-(--hl-md)" />
        <div>DESCRIPTION</div>
        <div />
      </div>
      <GridList onSelectionChange={() => {}} aria-label="SocketIO Events" items={rows}>
        {item => (
          <GridListItem
            className="group grid h-[30px] grid-cols-[30px_1fr_80px_1px_1fr_50px] items-center gap-2 border-x border-b border-solid border-(--hl-md) transition-all [&:hover_.deleteBtn]:flex"
            textValue="event item"
          >
            <div />
            <InputComponent
              className="w-full"
              defaultValue={item.eventName}
              placeholder="Add event"
              onChange={value => {
                handleChange({ ...item, eventName: value }, 'eventName');
              }}
              warning={item.warning}
            />
            <div className="text-left">
              <Switch
                isSelected={item.isOpen}
                onChange={isOpen => {
                  handleChange({ ...item, isOpen }, 'isOpen');
                }}
                isDisabled={item.eventName?.trim() === '' || item.disabled}
                className="flex h-full cursor-pointer items-center p-0"
              >
                {({ isSelected, isDisabled }) => {
                  return (
                    <div
                      className={classNames(
                        "flex h-4.5 w-[30px] items-center rounded-full border border-solid border-(--hl) bg-(--color-bg) transition-all duration-200 before:m-0.5 before:block before:h-3.5 before:w-3.5 before:rounded-full before:transition-all before:duration-200 before:content-['']",
                        {
                          'bg-(--color-surprise) before:translate-x-full before:bg-white': isSelected,
                          'before:bg-(--color-surprise)': !isSelected,
                          'cursor-not-allowed border-(--hl) before:bg-(--hl)': isDisabled,
                        },
                      )}
                    />
                  );
                }}
              </Switch>
            </div>
            <span className="h-full bg-(--hl-md)" />
            <input
              className="w-full"
              defaultValue={item.desc}
              placeholder="Description"
              onChange={e => {
                handleChange({ ...item, desc: e.target.value }, 'desc');
              }}
            />
            <div>
              <Button
                className="deleteBtn flex hidden h-[25px] w-[25px] items-center justify-center hover:bg-(--hl-xs)"
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
