import React from 'react';
import ToggleSwitch from './toggle-switch';
import '../../../../.storybook/index.less';

export default { title: 'Toggle Switch' };

const defaultOnChange = () => {};

export const Checked = () => <ToggleSwitch checked onChange={defaultOnChange} />;

export const Unchecked = () => <ToggleSwitch onChange={defaultOnChange} />;

export const Disabled = () => <ToggleSwitch disabled onChange={defaultOnChange} />;
