import React from 'react';
import Breadcrumb from './breadcrumb';

export default { title: 'Breadcrumb' };

export const _default = () => (
  <Breadcrumb className="breadcrumb" crumbs={['Documents', 'Deployment']} />
);
