import React from 'react';
import Header from './header';
import GravatarImg from './gravatar-img';
import Breadcrumb from './breadcrumb';
import Switch from './switch';

export default { title: 'Layout | Header' };

export const _default = () => <Header />;

export const _primary = () => (
  <Header
    gridLeft={
      <React.Fragment>
        <GravatarImg
          className="gravatar breadcrumbs"
          rounded
          email="support@insomnia.rest"
          size={24}
        />
        <Breadcrumb className="breadcrumb" crumbs={['Documents', 'Deployment']} />
      </React.Fragment>
    }
    gridCenter={<Switch />}
    gridRight={
      <React.Fragment>
        <div>right</div>
      </React.Fragment>
    }
  />
);
