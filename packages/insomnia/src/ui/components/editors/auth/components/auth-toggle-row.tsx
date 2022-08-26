import React, { FC, ReactNode, useCallback } from 'react';

import { toKebabCase } from '../../../../../common/misc';
import { useActiveRequest } from '../../../../hooks/use-active-request';
import { Button } from '../../../base/button';
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

const ToggleIcon: FC<{isOn: boolean}> = ({ isOn }) => isOn ? <i data-testid="toggle-is-on" className="fa fa-check-square-o" /> : <i data-testid="toggle-is-off" className="fa fa-square-o" />;

export const AuthToggleRow: FC<Props> = ({
  label,
  property,
  help,
  invert,
  onTitle = 'Disable item',
  offTitle = 'Enable item',
  disabled = false,
}) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const databaseValue = Boolean(authentication[property]);
  const toggle = useCallback(
    (_event: React.MouseEvent<HTMLButtonElement>, value?: boolean) =>
      patchAuth({ [property]: value }), [patchAuth, property]
  );

  const isActuallyOn = invert ? !databaseValue : databaseValue;

  const id = toKebabCase(label);
  const title = isActuallyOn ? onTitle : offTitle;

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <Button
        className="btn btn--super-duper-compact"
        id={id}
        onClick={toggle}
        value={!databaseValue}
        title={title}
        disabled={disabled}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </Button>
    </AuthRow>
  );
};
