import React, { ChangeEventHandler, FC, ReactNode, useCallback } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { SettingsOfType } from '../../../common/settings';
import * as models from '../../../models/index';
import { selectSettings } from '../../redux/selectors';
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
  const settings = useSelector(selectSettings);

  if (!settings.hasOwnProperty(setting)) {
    throw new Error(`Invalid boolean setting name ${setting}`);
  }

  const onChange = useCallback<ChangeEventHandler<HTMLInputElement>>(async ({ currentTarget: { checked } }) => {
    await models.settings.patch({ [setting]: checked });
  }, [setting]);

  return (
    <>
      <div className="form-control form-control--thin">
        <label className="inline-block">
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          <input
            checked={Boolean(settings[setting])}
            name={setting}
            onChange={onChange}
            type="checkbox"
            disabled={disabled}
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
    </>
  );
};
