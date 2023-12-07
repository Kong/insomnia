import React, { FC } from 'react';

import {
  REQUEST_DATASET_EDITOR_TAB,
  REQUEST_SETTER_EDITOR_TAB,
  REQUEST_SETTING_TAB,
  RESPONSE_VISUALIZE_EDITOR_TAB,
  TabType,
} from '../../../../common/constants';

interface Props {
  activeTab: TabType;
}

export const RequestUtilsEditors: FC<Props> = ({ activeTab }) => {
  switch (activeTab) {
    case REQUEST_DATASET_EDITOR_TAB:
      return <div>Dataset</div>;
    case REQUEST_SETTER_EDITOR_TAB:
      return <div>Setter</div>;
    case RESPONSE_VISUALIZE_EDITOR_TAB:
      return <div>Visualize</div>;
    case REQUEST_SETTING_TAB:
      return <div>Setting</div>;
    default:
      return (
        <div className="vertically-center text-center">
          <p className="pad super-faint text-sm text-center">
            <i
              className="fa fa-unlock-alt"
              style={{
                fontSize: '8rem',
                opacity: 0.3,
              }}
            />
            <br />
            <br />
            Select an util from above
          </p>
        </div>
      );
  }
};
