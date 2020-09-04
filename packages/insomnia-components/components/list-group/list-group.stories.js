// @flow
import React from 'react';
import ListGroupItem from './list-group-item';
import ListGroup from './list-group';
import UnitTestResultItem from './unit-test-result-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      <ListGroupItem>List</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);

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

export const _unitTestResults = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      {tests.map((test, i) => (
        <UnitTestResultItem item={test} key={i} />
      ))}
    </ListGroup>
  </div>
);
