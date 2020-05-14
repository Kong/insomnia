import React from 'react';
import HelpTooltip from './help-tooltip';

export default { title: 'Helpers | Help Tooltip' };

export const _default = () => (
  <p>
    Hover over the question mark to view <HelpTooltip>This is the help message</HelpTooltip>
  </p>
);
