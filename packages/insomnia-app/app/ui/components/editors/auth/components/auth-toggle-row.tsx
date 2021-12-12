import React, { FC, ReactNode, useCallback, useMemo } from 'react';

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

const ToggleIcon: FC<{isOn: boolean}> = ({ isOn }) => isOn ? <i className="fa fa-check-square-o" /> : <i className="fa fa-square-o" />;

export const AuthToggleRow: FC<Props> = ({
  label,
  property,
  help,
  invert,
  onTitle = 'Disable item',
  offTitle = 'Enable item',
}) => {
  const { activeRequest: { authentication }, patchAuth } = useActiveRequest();

  const isOn = Boolean(authentication[property]);
  const toggle = useCallback(() => patchAuth({ [property]: !isOn }), [isOn, patchAuth, property]);

  const isActuallyOn = invert ? !isOn : isOn;
  const id = useMemo(() => label.replace(/ /g, '-'), [label]);
  const title = isActuallyOn ? onTitle : offTitle;

  return (
    <AuthRow labelFor={id} label={label} help={help}>
      <Button
        className="btn btn--super-duper-compact"
        id={id}
        onClick={toggle}
        value={isActuallyOn}
        title={title}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </Button>
    </AuthRow>
  );
};
