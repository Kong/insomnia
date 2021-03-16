import React from 'react';
import Card from './card';
import CardContainer from './card-container';
import { boolean, text, withKnobs } from '@storybook/addon-knobs';
import { SvgIcon } from '../index';
import { IconEnum } from './svg-icon';

export default {
  title: 'Navigation | Card',
  decorators: [withKnobs],
};

export const _default = () => (
  <Card
    tagLabel={text('Label', 'OpenAPI 3.0')}
    docTitle={text('Title', 'Cloud OS Login')}
    docVersion={text('Version', 'v2.8.4')}
    docBranch={text('Branch', 'feat/small-changes')}
    docLog={text('Log', '2 hours ago by gschier')}
    docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
  />
);

export const _selectable = () => (
  <Card
    tagLabel={text('Label', 'OpenAPI 3.0')}
    docTitle={text('Title', 'Cloud OS Login')}
    docVersion={text('Version', 'v2.8.4')}
    docBranch={text('Branch', 'feat/small-changes')}
    docLog={text('Log', '2 hours ago by gschier')}
    docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
    selectable
  />
);

export const _deck = () => (
  <CardContainer>
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
    <Card
      tagLabel={text('Label', 'OpenAPI 3.0')}
      docTitle={text('Title', 'Cloud OS Login')}
      docVersion={text('Version', 'v2.8.4')}
      docBranch={text('Branch', 'feat/small-changes')}
      docLog={text('Log', '2 hours ago by gschier')}
      docMenu={<SvgIcon icon={IconEnum.ellipsis} />}
      selectable={boolean('Selectable?', false)}
    />
  </CardContainer>
);
