import React, { ChangeEvent, PropsWithChildren, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models/index';
import { Settings } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';

interface Props<T> {
  help?: ReactNode;
  label: string;
  setting: keyof Settings;
  values: {
    name: string;
    value: T;
  }[];
}

export const EnumSetting = <T extends string | number>({
  help,
  label,
  setting,
  values,
}: PropsWithChildren<Props<T>>) => {
  const settings = useSelector(selectSettings);

  const onChange = useCallback(async (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.currentTarget;
    await models.settings.patch({
      [setting]: value,
    });
  }, [setting]);

  return (
    <div className="form-control form-control--outlined">
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
