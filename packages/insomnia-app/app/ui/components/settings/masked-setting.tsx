import React, { ChangeEvent, FC, useState } from 'react';
import { useSelector } from 'react-redux';
import { useToggle } from 'react-use';

import * as models from '../../../models';
import { BaseSettings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const MaskedSetting: FC<{
  label: string;
  setting: keyof BaseSettings;
  help?: string;
  props?: React.HTMLProps<HTMLInputElement>;
}> = ({
  label,
  setting,
  help,
  props,
}) => {

  const [isHidden, setHidden] = useToggle(true);

  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid masked setting name ${setting}`);
  }

  const [input, setInput] = useState(String(settings[setting]));

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    // Update the input as soon as possible for lag-free experience
    setInput(event.currentTarget.value);
    // Meanwhile we wait the update
    return models.settings.patch({
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
          value={input}
          type={!settings.showPasswords && isHidden ? 'password' : 'text'}
          name={setting}
          onChange={onChange}
          {...props}
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
