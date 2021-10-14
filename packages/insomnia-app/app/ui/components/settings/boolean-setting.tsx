import { Settings } from 'insomnia-common';
import React, { ChangeEvent, FC, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { getControlledStatus } from '../../../models/helpers/settings';
import * as models from '../../../models/index';
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

export const BooleanSetting: FC<{
  /** each element of this array will appear as a paragraph below the setting describing it */
  descriptions?: string[];
  forceRestart?: boolean;
  help?: string;
  label: string;
  setting: keyof Settings;
}> = ({
  descriptions,
  forceRestart,
  help,
  label,
  setting,
}) => {
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  const { isControlled } = getControlledStatus(settings)(setting);

  const onChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.currentTarget;
    await models.settings.patch({
      [setting]: checked,
    });
  }, [setting]);

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
            checked={Boolean(settings[setting])}
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
