import classNames from 'classnames';
import React from 'react';
import { Button, Cell, Column, Row, Switch, Table, TableBody, TableHeader } from 'react-aria-components';

import { OneLineEditor } from '../codemirror/one-line-editor';
import { Icon } from '../icon';

const COLUMNS = [
  { name: 'EVENTS', id: 'event', isRowHeader: true },
  { name: 'LISTEN', id: 'listen' },
  { name: 'DESCRIPTION', id: 'description' },
];

const rows = [
  { id: '1', event: 'event1', listen: true, description: 'xxx' },
  { id: '2', event: 'event2', listen: false, description: 'xxx' },
  { id: '3', event: 'event3', listen: true, description: 'xxx' },
  { id: '4', event: 'event4', listen: false, description: 'xxx' },
];

export const SocketIOEventTabPane = () => {
  const handleAddEvent = () => {};
  const handleDeleteEvent = () => {};
  const handleToggleEvent = (isSelected: boolean) => {
    console.log('Toggle', isSelected);
  };
  return (
    <div className='p-4'>
      <Table className="w-full min-w-[400px] border-solid border-[1px] border-[--hl-md]">
      <TableHeader className="h-[30px] leading-[30px]" columns={COLUMNS}>
        <Column className="w-[30px]" />
        <Column className="w-[200px] text-left flex items-center" isRowHeader={true}>
          EVENTS
          <Button className="w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center ml-1" onPress={handleAddEvent}>
            <Icon icon="plus" className='cursor-pointer' />
          </Button>
        </Column>
        <Column className="w-[80px] border-solid border-r border-[--hl-md]">LISTEN</Column>
        <Column className="">DESCRIPTION</Column>
        <Column className="w-[40px]" />
      </TableHeader>
      <TableBody items={rows}>
        {item => (
          <Row className="border-t border-solid border-[--hl-md]" id={item.event} columns={COLUMNS}>
            <Cell className="w-[30px] align-middle" />
            <Cell className="h-[30px] align-middle">
              <OneLineEditor
                defaultValue={item.event}
                id={''}
                onChange={value => {
                  console.log('Changed', value);
                }}
              />
            </Cell>
            <Cell className="h-[30px] border-solid border-r border-[--hl-md]">
              <Switch
                isSelected={item.listen}
                onChange={isSelected => {
                  handleToggleEvent(isSelected);
                }}
                className="cursor-pointer p-0 h-full flex items-center justify-center"
              >
                {({ isSelected }) => {
                  return (
                    <div
                      className={classNames("w-[30px] h-4.5 border-solid border-[1px] border-[--hl] bg-[--color-bg] rounded-full transition-all duration-200 before:content-[''] before:block before:m-0.5 before:w-3.5 before:h-3.5 before:bg-[--color-surprise] before:rounded-full before:transition-all before:duration-200", {
                        'bg-[--color-surprise] before:bg-[--color-bg] before:translate-x-[100%]': isSelected,
                      })}
                    />
                  );
                }}
              </Switch>
            </Cell>
            <Cell className="h-[30px] align-middle pl-2">
              <OneLineEditor
                defaultValue={item.description}
                id={''}
                onChange={value => {
                    console.log('Changed', value);
                  }}
              />
            </Cell>
            <Cell className="text-center align-middle">
              <Button className="w-[25px] h-[25px] hover:bg-[--hl-xs] flex items-center justify-center" onPress={handleDeleteEvent}>
                <Icon icon="trash" className='cursor-pointer' />
              </Button>
            </Cell>
          </Row>
        )}
      </TableBody>
    </Table>
    </div>
  );
};
