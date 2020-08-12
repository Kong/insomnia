// @flow
import * as React from 'react';

import RadioButtonGroup from './radio-button-group';

export default { title: 'Navigation | Radio Button Group' };

export const _default = () => {
  const defaultValue = 'scratch';
  const [selectedValue, setSelectedValue] = React.useState(defaultValue);
  const onChangeHandler = v => {
    console.log(v);
    setSelectedValue(v);
  };

  return (
    <RadioButtonGroup
      name="dummy"
      defaultValue={defaultValue}
      onChange={onChangeHandler}
      choices={[
        { label: 'From Scratch', value: 'scratch' },
        { label: 'From Repository', value: 'repo' },
        { label: 'From Clipboard', value: 'clip' },
        { label: 'From Spec', value: 'spec' },
      ]}
      selectedValue={selectedValue}
    />
  );
};
