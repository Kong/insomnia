import * as React from 'react';
import MultiSwitch from './multi-switch';

export default { title: 'Navigation | Sliding Switch' };

export const _default = () => {
  const defaultValue = 'debug';
  const [selectedValue, setSelectedValue] = React.useState(defaultValue);
  const onChangeHandler = v => {
    console.log(v);
    setSelectedValue(v);
  };
  return (
    <MultiSwitch
      name="activity"
      defaultValue={defaultValue}
      onChange={onChangeHandler}
      choices={[
        { label: 'Design', value: 'design' },
        { label: 'Debug', value: 'debug' },
        { label: 'Test', value: 'test' },
      ]}
      selectedValue={selectedValue}
    />
  );
};
