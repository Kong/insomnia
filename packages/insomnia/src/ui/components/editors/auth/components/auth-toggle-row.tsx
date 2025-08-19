import React, { type FC, type ReactNode, useCallback } from 'react';

import { toKebabCase } from '~/common/misc';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  type RequestGroupLoaderData,
  useRequestGroupLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useRequestGroupPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

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
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData;
  const patchRequestGroup = useRequestGroupPatcher();
  const { authentication, _id } = reqData?.activeRequest || groupData?.activeRequestGroup || {};
  const patchRequest = useRequestPatcher();
  const patcher = reqData ? patchRequest : patchRequestGroup;

  // @ts-expect-error -- garbage abstraction
  const databaseValue = Boolean(authentication[property]);

  const onChange = useCallback(
    (value?: boolean) => patcher(_id, { authentication: { ...authentication, [property]: value } }),
    [patcher, _id, authentication, property],
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
