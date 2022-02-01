import { MultiSwitch } from 'insomnia-components';
import React, { FunctionComponent, useCallback } from 'react';
import { useSelector } from 'react-redux';

import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../common/constants';
import { isDesign } from '../../models/workspace';
import { selectActiveActivity, selectActiveWorkspace } from '../redux/selectors';
import { HandleActivityChange } from './wrapper';

interface Props {
  handleActivityChange: HandleActivityChange;
}

export const ActivityToggle: FunctionComponent<Props> = ({ handleActivityChange }) => {
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

  const activeActivity = useSelector(selectActiveActivity);
  const activeWorkspace = useSelector(selectActiveWorkspace);

  const onChange = useCallback((nextActivity: GlobalActivity) => {
    handleActivityChange({ workspaceId: activeWorkspace?._id, nextActivity });
  }, [handleActivityChange, activeWorkspace]);

  if (!activeActivity) {
    return null;
  }

  if (!activeWorkspace || !isDesign(activeWorkspace)) {
    return null;
  }

  return (
    <MultiSwitch
      name="activity-toggle"
      onChange={onChange}
      choices={choices}
      selectedValue={activeActivity}
    />
  );
};
