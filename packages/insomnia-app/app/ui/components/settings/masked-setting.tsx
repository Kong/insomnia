import React, { ChangeEvent, FC, useState } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import { BaseSettings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const MaskedSetting: FC<{
  label: string;
  setting: keyof BaseSettings;
  type: string;
  showPasswords: boolean;
  help?: string;
  props?: Record<string, any>;
}> = ({
  label,
  setting,
  type,
  showPasswords,
  help,
  props,
}) => {

  const [isHidden, setHidden] = useState(true);

  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid masked setting name ${setting}`);
  }

  const [input, setInput] = useState(settings[setting] + '');

  const onInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    await models.settings.patch({
      [setting]: value,
    });
    setInput(value);
  };

  return (
    <div>
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
      </label>
      <div className="form-control form-control--outlined form-control--btn-right">
        <input
          value={input}
          type={!showPasswords && isHidden ? 'password' : type}
          name={setting}
          onChange={onInputChange}
          {...props}
        />
        {!showPasswords && (
          <button className={'form-control__right'} onClick={() => setHidden(!isHidden)}>
            {isHidden ? <i className="fa fa-eye" /> : <i className="fa fa-eye-slash" />}
          </button>
        )}
      </div>
    </div>
  );
};
