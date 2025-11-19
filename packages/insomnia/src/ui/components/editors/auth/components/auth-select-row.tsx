import React, { type ChangeEvent, type FC, type ReactNode, useCallback } from 'react';

import { toKebabCase } from '~/common/misc';
import type { RequestAuthentication } from '~/models/request';
import { getAuthObjectOrNull } from '~/network/authentication';
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
  options: {
    name: string;
    value: string;
  }[];
  help?: ReactNode;
  disabled?: boolean;
}

export const AuthSelectRow: FC<Props> = ({ label, property, help, options, disabled }) => {
  const reqData = useRequestLoaderData() as RequestLoaderData;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patcher = reqData ? patchRequest : patchRequestGroup;

  const { authentication, _id } = reqData?.activeRequest || groupData?.activeRequestGroup || {};
  const authOrNull = getAuthObjectOrNull(authentication);
  const selectedValue = authOrNull ? authOrNull[property as keyof RequestAuthentication] + '' : options[0].value;

  const onChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      let updatedValue = event.currentTarget.value;
      // Convert boolean strings to boolean values for further processing.
      if (updatedValue === 'true' || updatedValue === 'false') {
        updatedValue = JSON.parse(updatedValue);
      }
      patcher(_id, { authentication: { ...authentication, [property]: updatedValue } });
    },
    [patcher, _id, authentication, property],
  );

  return (
    <AuthRow labelFor={toKebabCase(label)} label={label} help={help} disabled={disabled}>
      <select id={toKebabCase(label)} onChange={onChange} value={selectedValue} disabled={disabled}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
