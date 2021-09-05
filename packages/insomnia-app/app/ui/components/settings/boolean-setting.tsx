import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models/index';
import { BaseSettings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import HelpTooltip from '../help-tooltip';
import Tooltip from '../tooltip';

export const BooleanSetting: FC<{
  label: string;
  setting: keyof BaseSettings;
  help?: string;
  forceRestart?: boolean;
}> = ({
  label,
  setting,
  help,
  forceRestart,
}) => {
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.currentTarget;
    await models.settings.patch({
      [setting]: checked,
    });
  }, [setting]);

  return (
    <div className="form-control form-control--thin">
      <label className="inline-block">
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        {forceRestart && (
          <Tooltip message="Will restart the app" className="space-left">
            <i className="fa fa-refresh super-duper-faint" />
          </Tooltip>
        )}
        <input
          checked={Boolean(settings[setting])}
          name={setting}
          onChange={onChange}
          type="checkbox"
        />
      </label>
    </div>
  );
};
