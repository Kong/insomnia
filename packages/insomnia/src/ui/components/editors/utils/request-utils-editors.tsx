import React, { FC } from 'react';

import {
  REQUEST_DATASET_EDITOR_TAB,
  REQUEST_SETTER_EDITOR_TAB,
  REQUEST_SETTING_TAB,
  RESPONSE_VISUALIZE_EDITOR_TAB,
  TabType,
} from '../../../../common/constants';
import { ResponseVisualizeEditor } from './reponse-visualize-editor';
import { RequestDatasetEditor } from './request-dataset-editor';
import { RequestEventSetterEditor } from './request-event-setter-editor';
import { RequestSettingsEditor } from './request-settings-editor';
interface Props {
  activeTab: TabType;
  setLoading: (l: boolean) => void;
}

const DefaultUtilsEditor: FC = () => (
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
export const RequestUtilsEditors: FC<Props> = ({ activeTab, setLoading }) => {
  switch (activeTab) {
    case REQUEST_DATASET_EDITOR_TAB:
      return <RequestDatasetEditor setLoading={setLoading} />;
    case REQUEST_SETTER_EDITOR_TAB:
      return <RequestEventSetterEditor />;
    case RESPONSE_VISUALIZE_EDITOR_TAB:
      return <ResponseVisualizeEditor />;
    case REQUEST_SETTING_TAB:
      return <RequestSettingsEditor />;
    default:
      return <DefaultUtilsEditor />;
  }
};
