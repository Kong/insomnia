import React, { type ChangeEvent, type FC, type ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestGroupPatcher, useRequestPatcher } from '../../../../hooks/use-request';
import type { RequestLoaderData } from '../../../../routes/request';
import type { RequestGroupLoaderData } from '../../../../routes/request-group';
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
  const reqData = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const groupData = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patcher = Boolean(reqData) ? patchRequest : patchRequestGroup;

  const { authentication, _id } = reqData?.activeRequest || groupData.activeRequestGroup;
  // @ts-expect-error -- garbage abstraction
  const selectedValue = authentication.hasOwnProperty(property) ? authentication[property] : options[0].value;

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    let updatedValue = event.currentTarget.value;
    // Convert boolean strings to boolean values for further processing.
    if (updatedValue === 'true' || updatedValue === 'false') {
      updatedValue = JSON.parse(updatedValue);
    }
    patcher(_id, { authentication: { ...authentication, [property]: updatedValue } });
  }, [patcher, _id, authentication, property]);

  return (
    <AuthRow labelFor={toKebabCase(label)} label={label} help={help} disabled={disabled}>
      <select id={toKebabCase(label)} onChange={onChange} value={selectedValue}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
