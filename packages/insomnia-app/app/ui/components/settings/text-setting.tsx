import { SettingsOfType } from 'insomnia-common';
import React, { ChangeEvent, FC, InputHTMLAttributes, useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const TextSetting: FC<{
  help?: string;
  label: string;
  setting: SettingsOfType<string | null>;
  onChange?: InputHTMLAttributes<HTMLInputElement>['onChange'];
  placeholder?: InputHTMLAttributes<HTMLInputElement>['placeholder'];
  disabled?: InputHTMLAttributes<HTMLInputElement>['disabled'];
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
    const { value } = event.currentTarget;
    const updatedValue = value === null ? '__NULL__' : value;
    await models.settings.patch({
      [setting]: updatedValue,
    });

    event.persist();
    onChange?.(event);
  }, [onChange, setting]);

  let defaultValue = settings[setting];
  if (typeof defaultValue !== 'string') {
    defaultValue = '';
  }

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <input
          type={'text'}
          name={setting}
          defaultValue={defaultValue}
          onChange={handleOnChange}
        />
      </label>
    </div>
  );
};
