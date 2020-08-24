import React from 'react';
import ListGroup from './list-group';
import ListGroupItem from './list-group-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '400px' }}>
    <ListGroup>
      <ListGroupItem>List</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);
