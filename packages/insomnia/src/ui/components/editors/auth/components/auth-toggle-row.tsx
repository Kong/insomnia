import React, { type FC, type ReactNode, useCallback } from 'react';

import { toKebabCase } from '~/common/misc';

import { useAuthEditor } from '../use-auth-editor';
import { AuthRow } from './auth-row';

interface Props {
  label: string;
  property: string;
  invert?: boolean;
  help?: ReactNode;
  onTitle?: string;
  offTitle?: string;
  disabled?: boolean;
}

const ToggleIcon: FC<{ isOn: boolean }> = ({ isOn }) =>
  isOn ? (
    <i data-testid="toggle-is-on" className="fa fa-check-square-o" />
  ) : (
    <i data-testid="toggle-is-off" className="fa fa-square-o" />
  );

export const AuthToggleRow: FC<Props> = ({
  label,
  property,
  help,
  invert,
  onTitle = 'Disable item',
  offTitle = 'Enable item',
  disabled = false,
}) => {
  const { authentication, patchAuthentication } = useAuthEditor();

  // @ts-expect-error -- garbage abstraction
  const databaseValue = Boolean(authentication[property]);

  const onChange = useCallback(
    (value?: boolean) => patchAuthentication({ [property]: value }),
    [patchAuthentication, property],
  );
  const isActuallyOn = invert ? !databaseValue : databaseValue;

  return (
    <AuthRow labelFor={toKebabCase(label)} label={label} help={help} disabled={disabled}>
      <button
        className="btn btn--super-super-compact"
        id={toKebabCase(label)}
        onClick={() => onChange(!databaseValue)}
        title={isActuallyOn ? onTitle : offTitle}
        disabled={disabled}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </button>
    </AuthRow>
  );
};
