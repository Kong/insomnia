import React, { type FC, type ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestGroupPatcher, useRequestPatcher } from '../../../../hooks/use-request';
import type { RequestLoaderData } from '../../../../routes/request';
import type { RequestGroupLoaderData } from '../../../../routes/request-group';
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
  const reqData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const groupData = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const patchRequestGroup = useRequestGroupPatcher();
  const { authentication, _id } = reqData?.activeRequest || groupData.activeRequestGroup;
  const patchRequest = useRequestPatcher();
  const patcher = Boolean(reqData) ? patchRequest : patchRequestGroup;

  // @ts-expect-error -- garbage abstraction
  const databaseValue = Boolean(authentication[property]);

  const onChange = useCallback((value?: boolean) => patcher(_id, { authentication: { ...authentication, [property]: value } }),
    [patcher, _id, authentication, property]);
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
