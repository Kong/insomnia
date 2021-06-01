import React from 'react';
import { Breadcrumb } from './breadcrumb';

export default {
  title: 'Navigation | Breadcrumb',
};

export const _default = () => (
  <Breadcrumb
    className="breadcrumb"
    crumbs={[{ id: '1', node: 'Documents' }, { id: '2', node: 'Deployment', onClick: () => {} }, { id: '3', node: 'Another' }]}
  />
);
