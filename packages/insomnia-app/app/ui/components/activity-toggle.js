// @flow

import React from 'react';
import { MultiSwitch } from 'insomnia-components';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../common/constants';
import type { Workspace } from '../../models/workspace';

type Props = {
  activity: GlobalActivity,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  workspace: Workspace,
};

export default function ActivityToggle({ activity, handleActivityChange, workspace }: Props) {
  const choices = [
    { label: 'Design', value: ACTIVITY_SPEC },
    { label: 'Debug', value: ACTIVITY_DEBUG },
    { label: 'Test', value: ACTIVITY_UNIT_TEST },
  ];

  return (
    <MultiSwitch
      defaultValue={activity}
      name="activity-toggle"
      onChange={a => handleActivityChange(workspace._id, a)}
      choices={choices}
    />
  );
}
