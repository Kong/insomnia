import React, { FC } from 'react';

import { BooleanSetting } from './boolean-setting';

export const Experiments: FC = () => {
  return (
    <div className="pad-bottom">
      <div className="row-fill row-fill--top">
        <div>
          <BooleanSetting
            label="Pre-request Script"
            setting="experimentalFlagPreRequestScript"
            help="Enable pre-request script feature."
          />
        </div>
      </div>
    </div>
  );
};
