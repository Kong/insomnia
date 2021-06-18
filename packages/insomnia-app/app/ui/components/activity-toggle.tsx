import React, { FunctionComponent } from 'react';
import { MultiSwitch } from 'insomnia-components';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../common/constants';
import type { Workspace } from '../../models/workspace';

interface Props {
  activity: GlobalActivity;
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>;
  workspace: Workspace;
}

const ActivityToggle: FunctionComponent<Props> = ({ activity, handleActivityChange, workspace }) => {
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
      // @ts-expect-error -- TSCONVERSION
      onChange={a => handleActivityChange(workspace._id, a)}
      choices={choices}
      selectedValue={activity}
    />
  );
};

export default ActivityToggle;
