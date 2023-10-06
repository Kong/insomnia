import React, { PropsWithChildren, ReactNode } from 'react';

import { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { HelpTooltip } from '../help-tooltip';
interface Props<T> {
  help?: ReactNode;
  label: string;
  setting: SettingsOfType<string>;
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
  const {
    settings,
  } = useRootLoaderData();

  const patchSettings = useSettingsPatcher();

  return (
    <div className="form-control form-control--outlined">
      <label>
        {label}
        {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        <select
          value={String(settings[setting]) || '__NULL__'}
          name={setting}
          onChange={event => patchSettings({ [setting]: event.currentTarget.value })}

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
