import * as React from 'react';
import ToggleSwitch from './toggle-switch';

export default { title: 'Form Elements | Toggle Switch' };

const defaultOnChange = () => {};

export const Checked = () => <ToggleSwitch checked onChange={defaultOnChange} />;

export const Unchecked = () => <ToggleSwitch onChange={defaultOnChange} />;

export const Disabled = () => (
  <>
    <p>
      <ToggleSwitch disabled checked onChange={defaultOnChange} />
    </p>
    <p>
      <ToggleSwitch disabled onChange={defaultOnChange} />
    </p>
  </>
);

export const WithLabel = () => (
  <>
    <ToggleSwitch onChange={defaultOnChange()} label="text label" />
  </>
);
