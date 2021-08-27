import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
import HelpTooltip from '../help-tooltip';
import Tooltip from '../tooltip';

export const BooleanSetting: FC<{
  label: string;
  setting: string;
  help?: string;
  forceRestart?: boolean;
  callback?: () => void;
}> = ({
  label,
  setting,
  help,
  forceRestart,
  callback,
}) => {
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.currentTarget;
    await models.settings.update(settings, {
      [setting]: checked,
    });
    callback?.();
  }, [callback, setting, settings]);

  return (
    <div className="form-control form-control--thin">
      <label className="inline-block">
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        {forceRestart && (
          <Tooltip message="Will restart app" className="space-left">
            <i className="fa fa-refresh super-duper-faint" />
          </Tooltip>
        )}
        <input
          checked={settings[setting]}
          name={setting}
          onChange={onChange}
          type="checkbox"
        />
      </label>
    </div>
  );
};
