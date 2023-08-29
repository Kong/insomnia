import React, { FC } from 'react';
import { useToggle } from 'react-use';

import { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
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

  const {
    settings,
  } = useRootLoaderData();

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid setting name ${setting}`);
  }
  const patchSettings = useSettingsPatcher();

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
          onChange={event => patchSettings({ [setting]: event.currentTarget.value })}
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
