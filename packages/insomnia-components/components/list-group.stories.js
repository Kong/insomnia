import React from 'react';
import ListGroup from './list-group';
import ListGroupItem from './list-group-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '400px' }}>
    <ListGroup>
      <ListGroupItem
        name="My test name one"
        time="602ms"
        result="fail"
        errorMsg="Some dastardly error."
      />
      <ListGroupItem name="My test name two" time="6ms" result="pass" />
      <ListGroupItem name="My test name three" time="22ms" result="pass" />
      <ListGroupItem
        name="My test name four"
        time="602ms"
        result="fail"
        errorMsg="Some dastardly verbose error consuming a lot of space."
      />
    </ListGroup>
  </div>
);
