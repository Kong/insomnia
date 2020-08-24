import * as React from 'react';
import MultiSwitch from './multi-switch';

export default { title: 'Navigation / Multi Switch' };

export const _default = () => {
  const [selectedValue, setSelectedValue] = React.useState('debug');
  return (
    <MultiSwitch
      name="activity"
      onChange={setSelectedValue}
      choices={[
        { label: 'Design', value: 'design' },
        { label: 'Debug', value: 'debug' },
        { label: 'Test', value: 'test' },
      ]}
      selectedValue={selectedValue}
    />
  );
};
