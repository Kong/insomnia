import React from 'react';
import '../../../.storybook/index.less';
import Notice from './notice';

export default { title: 'Notice' };

export const _default = () => (
  <Notice>This is a notice. It is a bright block of text, meant to stand out from the rest!</Notice>
);

export const colors = () => (
  <div>
    <Notice color="surprise">
      This is a <strong>surprise</strong> notice
    </Notice>

    <Notice color="info">
      This is a <strong>info</strong> notice
    </Notice>

    <Notice color="warning">
      This is a <strong>warning</strong> notice
    </Notice>

    <Notice color="error">
      This is a <strong>error</strong> notice
    </Notice>

    <Notice color="subtle">
      This is a <strong>subtle</strong> notice
    </Notice>

    <Notice color="success">
      This is a <strong>success</strong> notice
    </Notice>
  </div>
);
