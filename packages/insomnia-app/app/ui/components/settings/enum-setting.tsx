import { HttpVersion } from 'insomnia-common';
import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models/index';
import { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

export const EnumSetting: FC<{
  help?: string;
  label: string;
  setting: keyof Settings;
  values: {
    name: string;
    value: HttpVersion;
  }[];
}> = ({
  help,
  label,
  setting,
  values,
}) => {
  const settings = useSelector(selectSettings);

  const onChange = useCallback(async (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.currentTarget;
    await models.settings.patch({
      [setting]: value,
    });
  }, [setting]);

  return (
    <div className="form-control form-control--outlined pad-top-sm">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <select
          value={String(settings[setting]) || '__NULL__'}
          name={setting}
          onChange={onChange}
        >
          {values.map(({ name, value }) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
};
