import React, { ChangeEventHandler, FC, InputHTMLAttributes, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { snapNumberToLimits } from '../../../common/misc';
import { SettingsOfType } from '../../../common/settings';
import * as models from '../../../models/index';
import { RootLoaderData } from '../../routes/root';
import { HelpTooltip } from '../help-tooltip';

interface Props {
  help?: string;
  label: string;
  max?: InputHTMLAttributes<HTMLInputElement>['max'];
  min: InputHTMLAttributes<HTMLInputElement>['min'];
  setting: SettingsOfType<number>;
  step?: InputHTMLAttributes<HTMLInputElement>['step'];
}

export const NumberSetting: FC<Props> = ({
  help,
  label,
  max,
  min,
  setting,
  step = 1,
}) => {
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;

  if (!Object.prototype.hasOwnProperty.call(settings, setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }

  const handleOnChange = useCallback<ChangeEventHandler<HTMLInputElement>>(async ({ currentTarget: { value, min, max } }) => {
    const updatedValue = snapNumberToLimits(
      parseInt(value, 10) || 0,
      parseInt(min, 10),
      parseInt(max, 10),
    );
    await models.settings.patch({ [setting]: updatedValue });
  }, [setting]);

  let defaultValue: string | number = settings[setting];
  if (typeof defaultValue !== 'number') {
    defaultValue = '';
  }

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <input
          defaultValue={defaultValue}
          max={max}
          min={min}
          name={setting}
          onChange={handleOnChange}
          type={'number'}
          step={step}
        />
      </label>
    </div>
  );
};
