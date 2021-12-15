import { SettingsOfType } from 'insomnia-common';
import React, { ChangeEvent, FC } from 'react';
import { useSelector } from 'react-redux';
import { useToggle } from 'react-use';

import * as models from '../../../models';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const MaskedSetting: FC<{
  disabled?: React.HTMLProps<HTMLInputElement>['disabled'];
  help?: string;
  label: string;
  placeholder?: React.HTMLProps<HTMLInputElement>['placeholder'];
  setting: SettingsOfType<string>;
}> = ({
  disabled,
  help,
  label,
  placeholder,
  setting,
}) => {
  const [isHidden, setHidden] = useToggle(true);

  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await models.settings.patch({
      [setting]: event.currentTarget.value,
    });
  };

  return (
    <div>
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
      </label>
      <div className="form-control form-control--outlined form-control--btn-right">
        <input
          defaultValue={String(settings[setting])}
          disabled={disabled}
          name={setting}
          onChange={onChange}
          placeholder={placeholder}
          type={!settings.showPasswords && isHidden ? 'password' : 'text'}
        />
        {!settings.showPasswords && (
          <button className={'form-control__right'} onClick={setHidden}>
            {isHidden ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
          </button>
        )}
      </div>
    </div>
  );
};
