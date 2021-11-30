import React, { ChangeEvent, FC, InputHTMLAttributes, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { snapNumberToLimits } from '../../../common/misc';
import * as models from '../../../models/index';
import { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const TextSetting: FC<{
  help?: string;
  label: string;
  setting: keyof Settings;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}> = ({
  help,
  label,
  setting,
  inputProps = {},
}) => {
  const settings = useSelector(selectSettings);

  if (!Object.prototype.hasOwnProperty.call(settings, setting)) {
    throw new Error(`Invalid number setting name ${setting}`);
  }

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { value, min, max } = event.currentTarget;
    let updatedValue: string | number | null | undefined = value;

    if (inputProps.type === 'number') {
      updatedValue = snapNumberToLimits(
        parseInt(value, 10) || 0,
        parseInt(min, 10),
        parseInt(max, 10),
      );
    }

    if (updatedValue === '__NULL__') {
      updatedValue = null;
    }

    await models.settings.patch({
      [setting]: updatedValue,
    });
    event.persist();
    inputProps.onChange?.(event);
  }, [inputProps, setting]);

  let defaultValue = settings[setting];
  if (typeof defaultValue !== 'string' && typeof defaultValue !== 'number') {
    defaultValue = '';
  }

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <input
          type={inputProps.type || 'text'}
          name={setting}
          defaultValue={defaultValue}
          {...inputProps}
          onChange={onChange}
        />
      </label>
    </div>
  );
};
