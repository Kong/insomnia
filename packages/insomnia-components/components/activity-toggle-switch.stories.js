import * as React from 'react';
import ActivityToggleSwitch from './activity-toggle-switch';

export default { title: '1st Party | Activity Toggle Switch' };

export const _default = () => (
  <ActivityToggleSwitch
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
