import React, { ChangeEvent, FC, InputHTMLAttributes, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { snapNumberToLimits } from '../../../common/misc';
import * as models from '../../../models/index';
import { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const NumberSetting: FC<{
  help?: string;
  label: string;
  setting: keyof Settings;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  min: InputHTMLAttributes<HTMLInputElement>['min'];
  max?: InputHTMLAttributes<HTMLInputElement>['max'];
}> = ({
  help,
  label,
  setting,
  onChange,
}) => {
  const settings = useSelector(selectSettings);

  if (!Object.prototype.hasOwnProperty.call(settings, setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }

  const handleOnChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { value, min, max } = event.currentTarget;
    const updatedValue = snapNumberToLimits(
      parseInt(value, 10) || 0,
      parseInt(min, 10),
      parseInt(max, 10),
    );
    await models.settings.patch({
      [setting]: updatedValue,
    });

    event.persist();
    onChange?.(event);
  }, [onChange, setting]);

  let defaultValue = settings[setting];
  if (typeof defaultValue !== 'number') {
    defaultValue = '';
  }

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <input
          type={'number'}
          name={setting}
          defaultValue={defaultValue}
          onChange={handleOnChange}
        />
      </label>
    </div>
  );
};
