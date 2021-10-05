import { MultiSwitch } from 'insomnia-components';
import React, { FunctionComponent } from 'react';

import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../common/constants';
import type { Workspace } from '../../models/workspace';

interface Props {
  activity: GlobalActivity;
  handleActivityChange: (options: {workspaceId?: string; nextActivity: GlobalActivity}) => Promise<void>;
  workspace: Workspace;
}

export const ActivityToggle: FunctionComponent<Props> = ({ activity, handleActivityChange, workspace }) => {
  const choices = [
    {
      label: 'Design',
      value: ACTIVITY_SPEC,
    },
    {
      label: 'Debug',
      value: ACTIVITY_DEBUG,
    },
    {
      label: 'Test',
      value: ACTIVITY_UNIT_TEST,
    },
  ];

  return (
    <MultiSwitch
      name="activity-toggle"
      onChange={(nextActivity: GlobalActivity) => handleActivityChange({ workspaceId: workspace._id, nextActivity })}
      choices={choices}
      selectedValue={activity}
    />
  );
};
