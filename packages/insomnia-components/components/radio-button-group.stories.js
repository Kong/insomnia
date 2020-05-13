// @flow
import * as React from 'react';

import RadioButtonGroup from './radio-button-group';

export default { title: 'Radio Button Group' };

export const _default = () => (
  <RadioButtonGroup>
    <label>
      <input type="radio" name="specSrc" value="scratch" onClick={() => window.alert('Selected')} />
      <span>From Scratch</span>
    </label>
    <label>
      <input
        type="radio"
        name="specSrc"
        value="repository"
        onClick={() => window.alert('Selected')}
      />
      <span>From Repository</span>
    </label>
    <label>
      <input
        type="radio"
        name="specSrc"
        value="clipboard"
        onClick={() => window.alert('Selected')}
      />
      <span>From Clipboard</span>
    </label>
    <label>
      <input
        type="radio"
        name="specSrc"
        value="wherever"
        onClick={() => window.alert('Selected')}
      />
      <span>From Wherever</span>
    </label>
  </RadioButtonGroup>
);
