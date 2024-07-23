import React, { type FC, type ReactNode } from 'react';
import styled from 'styled-components';

import type { SettingsOfType } from '../../../common/settings';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { HelpTooltip } from '../help-tooltip';
const Descriptions = styled.div({
  fontSize: 'var(--font-size-sm)',
  opacity: 'var(--opacity-subtle)',
  paddingLeft: 18,
  '& *': {
    marginTop: 'var(--padding-xs)',
    marginBottom: 'var(--padding-sm)',
  },
});

export const BooleanSetting: FC<{
  /** each element of this array will appear as a paragraph below the setting describing it */
  descriptions?: string[];
  help?: string;
  label: ReactNode;
  setting: SettingsOfType<boolean>;
  disabled?: boolean;
}> = ({
  descriptions,
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

      {descriptions && (
        <Descriptions>
          {descriptions.map(description => (
            <div key={description}>{description}</div>
          ))}
        </Descriptions>
      )}
    </>
  );
};
