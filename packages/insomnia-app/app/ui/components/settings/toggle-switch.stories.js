import React from 'react';
import ToggleSwitch from './toggle-switch';
import '../../../../.storybook/index.less';

export default { title: 'Toggle Switch' };

const defaultOnChange = () => {};

export const Checked = () => <ToggleSwitch name="Name" checked onChange={defaultOnChange} />;

export const Unchecked = () => <ToggleSwitch name="Name" onChange={defaultOnChange} />;

export const Disabled = () => (
  <ToggleSwitch name="Name" checked disabled onChange={defaultOnChange} />
);
