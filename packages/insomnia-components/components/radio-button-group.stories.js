// @flow
import * as React from 'react';

import RadioButtonGroup from './radio-button-group';

export default { title: 'Navigation | Radio Button Group' };

export const _default = () => {
  const [selectedValue, setSelectedValue] = React.useState('scratch');
  return (
    <RadioButtonGroup
      name="dummy"
      onChange={setSelectedValue}
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
