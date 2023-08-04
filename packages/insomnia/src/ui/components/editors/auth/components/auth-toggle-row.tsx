import React, { FC, ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestPatcher } from '../../../../hooks/use-request';
import { RequestLoaderData } from '../../../../routes/request';
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
  const { activeRequest: { authentication, _id: requestId } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequest = useRequestPatcher();

  const databaseValue = Boolean(authentication[property]);
  const toggle = useCallback((value?: boolean) => patchRequest(requestId, { authentication: { ...authentication, [property]: value } }), [authentication, patchRequest, property, requestId]);

  const isActuallyOn = invert ? !databaseValue : databaseValue;

  const id = toKebabCase(label);
  const title = isActuallyOn ? onTitle : offTitle;

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <button
        className="btn btn--super-duper-compact"
        id={id}
        onClick={() => toggle(!databaseValue)}
        title={title}
        disabled={disabled}
      >
        <ToggleIcon isOn={isActuallyOn} />
      </button>
    </AuthRow>
  );
};
