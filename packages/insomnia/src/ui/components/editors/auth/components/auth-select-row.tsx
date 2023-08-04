import React, { ChangeEvent, FC, ReactNode, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../../../common/misc';
import { useRequestPatcher } from '../../../../hooks/use-request';
import { RequestLoaderData } from '../../../../routes/request';
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
  const { activeRequest: { authentication, _id: requestId } } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const patchRequest = useRequestPatcher();

  const selectedValue = authentication.hasOwnProperty(property) ? authentication[property] : options[0].value;

  const onChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    let updatedValue = event.currentTarget.value;
    // Convert boolean strings to boolean values for further processing.
    if (updatedValue === 'true' || updatedValue === 'false') {
      updatedValue = JSON.parse(updatedValue);
    }
    patchRequest(requestId, { authentication: { ...authentication, [property]: updatedValue } });
  }, [authentication, patchRequest, property, requestId]);

  const id = toKebabCase(label);

  return (
    <AuthRow labelFor={id} label={label} help={help} disabled={disabled}>
      <select id={id} onChange={onChange} value={selectedValue}>
        {options.map(({ name, value }) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </AuthRow>
  );
};
