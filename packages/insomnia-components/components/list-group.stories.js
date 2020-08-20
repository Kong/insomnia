import React from 'react';
import ListGroup from './list-group';
import ListGroupItem from './list-group-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '300px' }}>
    <ListGroup className={'blah'}>
      <ListGroupItem
        name="My super du name"
        time="602ms"
        result="fail"
        errorMsg="Some dastardly error."
        className={'blah'}
      />
      <ListGroupItem name="My super du name" time="6ms" result="pass" />
      <ListGroupItem
        name="Aasdf asdf asdf adsf asdf dsfff"
        time="22ms"
        result="pass"
        className={'blah'}
      />
      <ListGroupItem
        name="My super du name"
        time="602ms"
        result="fail"
        errorMsg="Some dastardly error."
        className={'blah'}
      />
      <ListGroupItem
        name="My super du name"
        time="602ms"
        result="fail"
        errorMsg="Some dastardly error."
        className={'blah'}
      />
      <ListGroupItem name="My test name" time="430ms" result="pass" />
      <ListGroupItem name="My super du name" time="6ms" result="pass" />
      <ListGroupItem
        name="Aasdf asdf asdf adsf asdf dsfff"
        time="22ms"
        result="pass"
        className={'blah'}
      />
      <ListGroupItem name="My test name" time="430ms" result="pass" />
    </ListGroup>
  </div>
);
