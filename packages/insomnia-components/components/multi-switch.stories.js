import * as React from 'react';
import MultiSwitch from './multi-switch';

export default { title: '1st Party | Multi Switch' };

export const _default = () => (
  <MultiSwitch
    name="activity"
    defaultValue="debug"
    onChange={v => console.log(v)}
    choices={[
      { label: 'Design', value: 'design' },
      { label: 'Debug', value: 'debug' },
      { label: 'Test', value: 'test' },
    ]}
  />
);
