import classNames from 'classnames';
import React from 'react';
import { Button, GridList, GridListItem, Switch } from 'react-aria-components';

import type { SocketIOEventListeners, SocketIORequest } from '../../../models/socket-io-request';
import { useRequestPatcher } from '../../hooks/use-request';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { Icon } from '../icon';

interface Props {
  request: SocketIORequest;
  eventListeners: SocketIOEventListeners[];
}

export const SocketIOEventTabPane = ({ request, eventListeners }: Props) => {
  const requestPatcher = useRequestPatcher();
  const handleAddEvent = () => {
    // requestPatcher(request._id, { eventListeners });
  };

  const handleDeleteEvent = (eventName: string) => {
    const newListeners = eventListeners.filter(item => item.eventName !== eventName);
    requestPatcher(request._id, { eventListeners: newListeners });
  };

  const handleChange = (key: string, value: string | boolean, eventName: string) => {
    let newListeners = [...eventListeners];
    if (newListeners.length === 0) {
      newListeners = [{
        eventName: '',
        desc: '',
        isOpen: false,
        [key]: value,
      }];
    } else {
      const editExisting = newListeners.some(item => item.eventName === eventName);
      if (!editExisting) {
        newListeners = [...newListeners, {
          eventName: '',
          desc: '',
          isOpen: false,
          [key]: value,
        }];
      } else {
        newListeners = newListeners.map(item => {
          if (item.eventName === eventName) {
            return {
              ...item,
              [key]: value,
            };
          }
          return item;
        });
      }
    }
    requestPatcher(request._id, { eventListeners: newListeners });
  };

  const rows = [...eventListeners.map((item, index) => ({
    id: index,
    eventName: item.eventName,
    isOpen: item.isOpen,
    description: item.desc,
  })), {
    id: -1,
    eventName: '',
    isOpen: false,
    description: '',
  }];

  return (
    <div className='p-4'>
      <div className='grid grid-cols-[30px_1fr_80px_1fr_50px] gap-2 border-solid border border-[--hl-md]'>
        <div />
        <div className='flex items-center'>
          EVENTS
          <Button className="w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center ml-1" onPress={handleAddEvent}>
            <Icon icon="plus" className='cursor-pointer' />
          </Button>
        </div>
        <div className='border-solid border-r border-[--hl-md]'>LISTEN</div>
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
            className="group h-[30px] grid grid-cols-[30px_1fr_80px_1fr_50px] gap-2 border-solid border-b border-x border-[--hl-md] [&:hover_.deleteBtn]:flex transition-all"
            textValue='event item'
          >
            <div />
            <OneLineEditor
              defaultValue={item.eventName}
              id={''}
              placeholder='Add event'
              onChange={value => {
                handleChange('eventName', value, item.eventName);
              }}
            />
            <div className='border-solid border-r border-[--hl-md] text-left'>
              <Switch
                isSelected={item.isOpen}
                onChange={isSelected => {
                  handleChange('isOpen', isSelected, item.eventName);
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
              defaultValue={item.description}
              id={''}
              onChange={value => {
                handleChange('desc', value, item.eventName);
              }}
            />
            <div>
              <Button className="hidden deleteBtn w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center" onPress={() => handleDeleteEvent(item.eventName)}>
                <Icon icon="trash" className='cursor-pointer' />
              </Button>
            </div>
          </GridListItem >
        )}
      </GridList >
    </div >
  );
};
