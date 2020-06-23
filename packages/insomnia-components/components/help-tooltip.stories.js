import React from 'react';
import HelpTooltip from './help-tooltip';

export default { title: 'Helpers | Help Tooltip' };

export const _question = () => (
  <div>
    Hover over the question mark to view <HelpTooltip>This is the help message</HelpTooltip>
  </div>
);

export const _info = () => (
  <div>
    Hover over the info mark to view <HelpTooltip info>This is the help message</HelpTooltip>
  </div>
);

export const _onTop = () => (
  <div>
    Hover over the info mark to view <HelpTooltip info>This is the help message</HelpTooltip>
  </div>
);

export const _onRight = () => (
  <div>
    Hover over the info mark to view
    <HelpTooltip position="right">This is the help message</HelpTooltip>
  </div>
);

export const _onLeft = () => (
  <div>
    Hover over the info mark to view
    <HelpTooltip position="left">This is the help message</HelpTooltip>
  </div>
);

export const _withDelay = () => (
  <div>
    Hover over the info mark to view
    <HelpTooltip delay={900}> This tooltip had a 900ms delay</HelpTooltip>
  </div>
);
