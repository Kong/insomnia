import React from 'react';
import Card from './card';
import CardContainer from './card-container';
import { withKnobs, text, boolean } from '@storybook/addon-knobs';

export default {
  title: 'Card',
  decorators: [withKnobs],
};

export const _default = () => (
  <Card
    onClick={null}
    tagLabel={text('OAS 2.0')}
    docTitle={text('Title', 'Cloud OS Login')}
    docVersion={text('Version', 'v2.8.4')}
    docBranch={text('Branch', 'feat/small-changes')}
    docLog={text('Log', '2 hours ago by gschier')}
    docMenu="..."
  />
);

export const _selectable = () => (
  <Card
    onClick={null}
    tagLabel={text('OAS 2.0')}
    docTitle={text('Title', 'Cloud OS Login')}
    docVersion={text('Version', 'v2.8.4')}
    docBranch={text('Branch', 'feat/small-changes')}
    docLog={text('Log', '2 hours ago by gschier')}
    docMenu="..."
    selectable
  />
);

export const _deck = () => (
  <CardContainer>
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      onClick={null}
      tagLabel={text('OAS 2.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      selectable={boolean('Selectable?', false)}
    />
  </CardContainer>
);
