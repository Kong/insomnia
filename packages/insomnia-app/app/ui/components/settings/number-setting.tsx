import React, { ComponentProps, FC } from 'react';

import { TextSetting } from './text-setting';

export const NumberSetting: FC<ComponentProps<typeof TextSetting>> = props => (
  <TextSetting
    {...props}
    inputProps={{
      ...(props.inputProps || {}),
      type: 'number',
    }}
  />
);
