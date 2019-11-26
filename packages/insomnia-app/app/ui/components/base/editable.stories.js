import React from 'react';
import '../../../../.storybook/index.less';
import Editable from './editable';

export default { title: 'Editable' };

export const input = () => (
  <Editable value="Double-click to edit me" onSubmit={v => console.log('New value', v)} />
);
