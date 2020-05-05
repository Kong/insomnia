import * as React from 'react';
import ToggleSwitch from './toggle-switch';

export default { title: '1 | 2 / Toggle Switch' };

const defaultOnChange = () => {};

export const Checked = () => <ToggleSwitch checked onChange={defaultOnChange} />;

export const Unchecked = () => <ToggleSwitch onChange={defaultOnChange} />;

export const Disabled = () => (
  <>
    <ToggleSwitch disabled checked onChange={defaultOnChange} />
    <ToggleSwitch disabled onChange={defaultOnChange} />
  </>
);
