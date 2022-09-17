import React, { FC, useCallback } from 'react';

import { toKebabCase } from '../../../../../common/misc';
import { useActiveWorkspace } from '../../../../hooks/use-active-workspace';
import { Button } from '../../../base/button';
import { HelpTooltip } from '../../../help-tooltip';
import { AuthRow } from './auth-row';

interface AuthInputRowProps {
  label: string;
  property: string;
  help?: string;
  onTitle?: string;
  offTitle?: string;
  invert?: boolean;
}

const ToggleIcon: FC<{isOn: boolean}> = ({ isOn }) => isOn ? <i data-testid="toggle-is-on" className="fa fa-check-square-o" /> : <i data-testid="toggle-is-off" className="fa fa-square-o" />;

export const AuthToggleRow: FC<AuthInputRowProps> = ({
  label,
  property,
  invert,
  help,
  onTitle = 'Disable item',
  offTitle = 'Enable item',
}) => {
  const { activeWorkspace: { authentication }, patchAuth } = useActiveWorkspace();

  const databaseValue = Boolean(authentication[property]);
  const isActuallyOn = invert ? !databaseValue : databaseValue;

  const id = toKebabCase(label);
  const title = isActuallyOn ? onTitle : offTitle;

  const onClick = useCallback((_, value?: boolean) => patchAuth({ [property]: value }), [patchAuth, property]);

  return (
    <AuthRow className="form-control form-control--outlined row">
      <Button
        id={id}
        className="btn btn--super-duper-compact no-margin-top"
        title={title}
        onClick={onClick}
        value={!databaseValue}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </Button>

      <div className="vertically-center" style={{ gap: 'var(--padding-sm)' }}>
        <label className="no-margin-top" htmlFor={id}>{label}</label>
        {help ? <HelpTooltip>{help}</HelpTooltip> : null}
      </div>
    </AuthRow>
  );
};
