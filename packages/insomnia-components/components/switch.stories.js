import React from 'react';
import Switch from './switch';

export default { title: '1st Party | Sliding Switch' };

export const _design = () => (
  <Switch
    optionItems={[
      { label: 'DESIGN', selected: true },
      { label: 'DEBUG', selected: false },
    ]}
  />
);

export const _debug = () => (
  <Switch
    optionItems={[
      { label: 'DESIGN', selected: false },
      { label: 'DEBUG', selected: true },
    ]}
  />
);
