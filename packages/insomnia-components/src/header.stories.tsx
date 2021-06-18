import React, { Fragment } from 'react';
import { Header } from './header';
import { Breadcrumb } from './breadcrumb';
import { Switch } from './switch';

export default {
  title: 'Layout | Header',
};

export const _default = () => <Header />;

export const _primary = () => (
  <Header
    gridLeft={
      <Fragment>
        <Breadcrumb
          crumbs={[{ id: '1', node: 'Documents' }, { id: '2', node: 'Deployment' }]}
        />
      </Fragment>
    }
    gridCenter={<Switch />}
    gridRight={
      <Fragment>
        <div>right</div>
      </Fragment>
    }
  />
);
