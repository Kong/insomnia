import React, { ChangeEvent, FC, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import { BaseSettings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import HelpTooltip from '../help-tooltip';

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

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    await models.settings.patch({
      [setting]: event.currentTarget.value,
    });
  }, [setting]);

  return (
    <div>
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
      </label>
      <div className="form-control form-control--outlined form-control--btn-right">
        <input
          value={settings[setting] + ''}
          type={!showPasswords && isHidden ? 'password' : type}
          name={setting}
          onChange={onChange}
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
