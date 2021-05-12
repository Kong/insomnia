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
          className="breadcrumb"
          crumbs={['Documents', 'Deployment']}
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
