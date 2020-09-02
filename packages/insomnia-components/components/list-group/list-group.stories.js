// @flow
import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import ListGroupItem from './list-group-item';
import ListGroup from './list-group';
import UnitTestResultItem from './unit-test-result-item';

export default { title: 'Lists | List Group' };

const StyledContent: React.ComponentType<{}> = styled(motion.div)`
  display: block;
  height: 1px;
  padding: var(--padding-sm);
  border: 1px solid #ccc;
  margin: var(--padding-md) 0px;
`;

const tests = [
  {
    title: 'Title of my test',
    duration: '23',
    err: {
      message: '',
    },
  },
  {
    title: 'Title of my test',
    duration: '201',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    title: 'Title of my test',
    duration: '87',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    title: 'Title of my test',
    duration: '300',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
];

export const _default = () => {
  const [items, setItems] = React.useState([]);
  const newItems = [];
  const _handleItemClick = position => {
    setItems([]);
    tests.map((test, i) => {
      let visible = false;
      if (position === i) {
        visible = true;
      }
      newItems.push({ position: i, visible: visible });
    });
    setItems(newItems);
  };

  return (
    <div style={{ width: '350px' }}>
      <ListGroup>
        {tests.map((test, i) => (
          <ListGroupItem
            key={i}
            onClick={() => {
              _handleItemClick(i);
            }}>
            {test.title}
            {items && items.length > 1 && items[i].position === i && items[i].visible === true && (
              <StyledContent
                initial={{ height: items[i].visible ? '0px' : '0px' }}
                animate={{ height: items[i].visible ? '100px' : '0px' }}>
                Item: {items[i].position}
              </StyledContent>
            )}
          </ListGroupItem>
        ))}
      </ListGroup>
    </div>
  );
};

export const _unitTestResults = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      {tests.map((test, i) => (
        <UnitTestResultItem item={test} key={i} />
      ))}
    </ListGroup>
  </div>
);
