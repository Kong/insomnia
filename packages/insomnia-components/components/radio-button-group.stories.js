// @flow
import * as React from 'react';

import RadioButtonGroup from './radio-button-group';

export default { title: '1st Party | Radio Button Group' };

export const _default = () => (
  <RadioButtonGroup
    name="dummy"
    defaultValue="scratch"
    onChange={v => console.log(v)}
    choices={[
      { label: 'From Scratch', value: 'scratch' },
      { label: 'From Repository', value: 'repo' },
      { label: 'From Clipboard', value: 'clip' },
      { label: 'From Spec', value: 'spec' },
    ]}
  />
);
