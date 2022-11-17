import React, { ChangeEventHandler, FC, InputHTMLAttributes, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { SettingsOfType } from '../../../common/settings';
import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const TextSetting: FC<{
  disabled?: InputHTMLAttributes<HTMLInputElement>['disabled'];
  help?: string;
  label: string;
  placeholder?: InputHTMLAttributes<HTMLInputElement>['placeholder'];
  setting: SettingsOfType<string | null>;
}> = ({
  disabled,
  help,
  label,
  placeholder,
  setting,
}) => {
  const settings = useSelector(selectSettings);

  if (!Object.prototype.hasOwnProperty.call(settings, setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }

  const handleOnChange = useCallback<ChangeEventHandler<HTMLInputElement>>(async ({ currentTarget: { value } }) => {
    const updatedValue = value === null ? '__NULL__' : value;
    await models.settings.patch({ [setting]: updatedValue });
  }, [setting]);

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
          defaultValue={defaultValue}
          disabled={disabled}
          name={setting}
          onChange={handleOnChange}
          placeholder={placeholder}
          type={'text'}
        />
      </label>
    </div>
  );
};
