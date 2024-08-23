import React, { type FC, type ReactNode } from 'react';

import type { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { HelpTooltip } from '../help-tooltip';

export const BooleanSetting: FC<{
  help?: string;
  label: ReactNode;
  setting: SettingsOfType<boolean>;
  disabled?: boolean;
}> = ({
  help,
  label,
  setting,
  disabled = false,
}) => {
  const {
    settings,
  } = useRootLoaderData();
  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }
  const patchSettings = useSettingsPatcher();

  return (
    <>
      <div className="">
        <label className="flex items-center gap-2">
          <input
            checked={Boolean(settings[setting])}
            name={setting}
            onChange={event => patchSettings({ [setting]: event.currentTarget.checked })}
            type="checkbox"
            disabled={disabled}
          />
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
        </label>
      </div>
    </>
  );
};
