import React, { FC, ReactNode, useCallback } from 'react';

import { kebabCase } from '../../../../../common/misc';
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
}

const ToggleIcon: FC<{isOn: boolean}> = ({ isOn }) => isOn ? <i data-testid="toggle-is-on" className="fa fa-check-square-o" /> : <i data-testid="toggle-is-off" className="fa fa-square-o" />;

export const AuthToggleRow: FC<Props> = ({
  label,
  property,
  help,
  invert,
  onTitle = 'Disable item',
  offTitle = 'Enable item',
}) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const databaseValue = Boolean(authentication[property]);
  const toggle = useCallback((value: boolean) => patchAuth({ [property]: value }), [patchAuth, property]);

  const isActuallyOn = invert ? !databaseValue : databaseValue;

  const id = kebabCase(label);
  const title = isActuallyOn ? onTitle : offTitle;

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <Button
        className="btn btn--super-duper-compact"
        id={id}
        onClick={toggle}
        value={!databaseValue}
        title={title}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </Button>
    </AuthRow>
  );
};
