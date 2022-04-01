import { SettingsOfType } from 'insomnia-common';
import React, { ChangeEventHandler, FC, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { getControlledStatus } from '../../../models/helpers/settings';
import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
import { HelpTooltip } from '../help-tooltip';
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
  help?: string;
  label: ReactNode;
  setting: SettingsOfType<boolean>;
}> = ({
  descriptions,
  help,
  label,
  setting,
}) => {
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  const { isControlled } = getControlledStatus(settings)(setting);

  const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(async ({ currentTarget: { checked } }) => {
    await models.settings.patch({ [setting]: checked });
  }, [setting]);

  return (
    <ControlledSetting setting={setting}>
      <div className="form-control form-control--thin">
        <label className="inline-block">
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
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
