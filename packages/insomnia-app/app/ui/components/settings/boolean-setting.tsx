import { Settings } from 'insomnia-common';
import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import * as models from '../../../models/index';
import { isConfigControlledSetting } from '../../../models/settings';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';
import { ControlledSetting } from './controlled-setting';

const Descriptions = styled.div({
  fontSize: 'var(--font-size-sm)',
  opacity: 'var(--opacity-subtle)',
  paddingLeft: 18,
  '& *': {
    marginTop: 'var(--padding-xs)',
    marginBottom: 'var(--padding-sm)',
  },
});

// would be nice to use RequireAllOrNone from type-fest when we can update to type-fest 2.0
interface Overridden {
  overrideSetting?: keyof Settings;
  overrideValue?: boolean;
}

export const BooleanSetting: FC<{
  /** each element of this array will appear as a paragraph below the setting describing it */
  descriptions?: string[];
  forceRestart?: boolean;
  help?: string;
  label: string;
  setting: keyof Settings;
} & Overridden> = ({
  descriptions,
  forceRestart,
  help,
  label,
  overrideSetting,
  overrideValue,
  setting,
}) => {
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  if (overrideSetting && !settings.hasOwnProperty(overrideSetting)) {
    throw new Error(`Invalid boolean setting override name ${overrideSetting}`);
  }

  const [isControlled] = isConfigControlledSetting(setting, settings);

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.currentTarget;
    await models.settings.patch({
      [setting]: checked,
    });
  }, [setting]);

  let checked = Boolean(settings[setting]);
  if (overrideValue !== undefined) {
    checked = overrideValue;
  }

  return (
    <ControlledSetting setting={setting}>
      <div className="form-control form-control--thin">
        <label className="inline-block">
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          {forceRestart && (
            <Tooltip message="Will restart the app" className="space-left">
              <i className="fa fa-refresh super-duper-faint" />
            </Tooltip>
          )}
          <input
            checked={checked}
            name={setting}
            onChange={onChange}
            type="checkbox"
            disabled={isControlled}
          />
        </label>
      </div>

      {descriptions && (
        <Descriptions>
          {descriptions.map(description => (
            <div key={description}>{description}</div>
          ))}
        </Descriptions>
      )}
    </ControlledSetting>
  );
};
